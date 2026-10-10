import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { Request } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type IORedis from 'ioredis';
import '../session/session-data';
import {
  DEFAULT_RATE_LIMIT,
  ipPointsFor,
  isMutatingRequest,
  RATE_LIMIT_OPTIONS,
  RateLimitOptions,
} from './rate-limit.constants';
import { RATE_LIMIT_VALKEY_CLIENT } from './rate-limit-valkey-client.provider';
import { SKIP_RATE_LIMIT_KEY } from './skip-rate-limit.decorator';
import { clientIp } from '../common/client-ip.decorator';

// Strikes (lockout violations) decay after an hour of no further
// violations on that dimension, so a stale block count doesn't keep
// escalating a caller's lockout indefinitely.
const STRIKE_RESET_SECONDS = 3600;
// Cap on how long a single lockout can run, how ever many strikes accrue.
const MAX_BLOCK_SECONDS = 3600;

/**
 * Valkey-backed request throttling with progressive lockout.
 *
 * Checks two independent dimensions per request: the source IP (or the
 * member, for `perMember`), and the submitted identifier when the route
 * names an `identifierField` — so rotating one doesn't dodge the other.
 * Exceeding a budget locks that dimension out; each further violation
 * before the strikes decay doubles the block, up to `MAX_BLOCK_SECONDS`.
 *
 * Registered as a global `APP_GUARD`. SessionModule is imported before
 * SecurityModule so SessionAuthGuard rejects unauthenticated floods first,
 * without a Valkey round-trip (pinned by session.integration-spec.ts).
 *
 * `@SkipRateLimit()` opts out and `@RateLimit(...)` sets the budget, on any
 * verb. Without either, reads pass and mutations get `DEFAULT_RATE_LIMIT`,
 * a backstop: the `require-rate-limit-decision` eslint rule already
 * demands a decision on every mutating handler.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiters = new Map<string, RateLimiterRedis>();

  constructor(
    @Inject(RATE_LIMIT_VALKEY_CLIENT)
    private readonly valkeyClient: IORedis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip =
      this.reflector.get<boolean>(SKIP_RATE_LIMIT_KEY, context.getHandler()) ??
      this.reflector.get<boolean>(SKIP_RATE_LIMIT_KEY, context.getClass());
    if (skip) {
      return true;
    }

    const explicitOptions =
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_OPTIONS, context.getHandler()) ??
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_OPTIONS, context.getClass());

    const req = context.switchToHttp().getRequest<Request>();
    if (!explicitOptions && !isMutatingRequest(req)) {
      return true;
    }

    const options = explicitOptions ?? DEFAULT_RATE_LIMIT;
    if (options.appliesTo && !options.appliesTo(req)) {
      return true;
    }
    // One counter per route, unless the options name a shared scope.
    const routeKey = options.scope ?? `${context.getClass().name}#${context.getHandler().name}`;
    for (const dimension of this.dimensions(req, options, routeKey)) {
      await this.checkDimension(dimension, options.durationSeconds);
    }
    return true;
  }

  /**
   * The source IP (or the member, for `perMember`), plus the submitted
   * identifier when the route names one, each keyed under `routeKey`.
   */
  private dimensions(
    req: Request,
    options: RateLimitOptions,
    routeKey: string,
  ): { key: string; points: number }[] {
    const memberId = options.perMember ? req.session?.memberId : undefined;
    const dims = [
      memberId
        ? { key: `${routeKey}:member:${memberId}`, points: options.points }
        : { key: `${routeKey}:ip:${clientIp(req)}`, points: ipPointsFor(options) },
    ];
    const rawIdentifier = options.identifierField
      ? (req.body as Record<string, unknown> | undefined)?.[options.identifierField]
      : undefined;
    if (typeof rawIdentifier === 'string' && rawIdentifier.length > 0) {
      // Normalized like the email lookups (find-member-by-email.ts), or
      // each case variant of one address would get its own budget.
      const normalizedIdentifier = rawIdentifier.trim().toLowerCase();
      // Hashed: guards run before ValidationPipe, so this is unbounded raw
      // input, and a raw key would store emails and tokens in Valkey.
      const identifierHash = createHash('sha256').update(normalizedIdentifier).digest('base64url');
      dims.push({
        key: `${routeKey}:id:${identifierHash}`,
        points: options.points,
      });
    }
    return dims;
  }

  private async checkDimension(
    dimension: { key: string; points: number },
    durationSeconds: number,
  ): Promise<void> {
    if (await this.valkeyClient.exists(`rl:block:${dimension.key}`)) {
      throw this.tooManyRequests();
    }

    const limiter = this.limiterFor(dimension.points, durationSeconds);
    try {
      await limiter.consume(dimension.key);
    } catch (rejection) {
      if (rejection instanceof Error) {
        throw rejection;
      }
      await this.lockOut(dimension.key, durationSeconds);
      throw this.tooManyRequests();
    }
  }

  // The limiter budget was exhausted: escalate this dimension's lockout.
  // Strike 1 blocks for one base window, strike 2 doubles it, and so on
  // up to the cap; strikes decay if the dimension stays quiet for a while.
  private async lockOut(dimensionKey: string, durationSeconds: number): Promise<void> {
    const strikeKey = `rl:strikes:${dimensionKey}`;
    const strikes = await this.valkeyClient.incr(strikeKey);
    if (strikes === 1) {
      await this.valkeyClient.expire(strikeKey, STRIKE_RESET_SECONDS);
    }
    const blockSeconds = Math.min(MAX_BLOCK_SECONDS, durationSeconds * 2 ** (strikes - 1));
    await this.valkeyClient.set(`rl:block:${dimensionKey}`, '1', 'EX', blockSeconds);
  }

  private tooManyRequests(): HttpException {
    return new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  private limiterFor(points: number, durationSeconds: number): RateLimiterRedis {
    const cacheKey = `${points}:${durationSeconds}`;
    let limiter = this.limiters.get(cacheKey);
    if (!limiter) {
      limiter = new RateLimiterRedis({
        storeClient: this.valkeyClient,
        keyPrefix: 'rl',
        points,
        duration: durationSeconds,
      });
      this.limiters.set(cacheKey, limiter);
    }
    return limiter;
  }
}
