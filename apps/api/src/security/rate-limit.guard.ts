import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { RedisClientType } from 'redis';
import {
  DEFAULT_RATE_LIMIT,
  ipPointsFor,
  RATE_LIMIT_OPTIONS,
  RateLimitOptions,
} from './rate-limit.constants';
import { RATE_LIMIT_VALKEY_CLIENT } from './rate-limit-valkey-client.provider';
import { SKIP_RATE_LIMIT_KEY } from './skip-rate-limit.decorator';

// Strikes (lockout violations) decay after an hour of no further
// violations on that dimension, so a stale block count doesn't keep
// escalating a caller's lockout indefinitely.
const STRIKE_RESET_SECONDS = 3600;
// Cap on how long a single lockout can run, how ever many strikes accrue.
const MAX_BLOCK_SECONDS = 3600;

// Mirrors eslint.config.mjs's MUTATING_HTTP_DECORATORS — kept as a separate
// runtime list rather than shared, since one reads decorator names off an
// AST at lint time and the other reads `req.method` at request time.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Valkey-backed request throttling with progressive lockout.
 *
 * Brute-force protection is rate-limited *per account and per source
 * address*, each enforced independently, with repeated failures
 * triggering progressive throttling. This guard therefore checks two
 * separate dimensions per request — the source IP, and (when the route
 * declares `identifierField`) the submitted identifier, e.g. email — each
 * with its own fixed-window counter. Exceeding either dimension's budget
 * locks that dimension out; each further violation while the lockout
 * "strike" count hasn't decayed doubles the block duration, up to
 * `MAX_BLOCK_SECONDS`. Rotating IPs against one account, or rotating
 * accounts from one IP, therefore doesn't dodge the limit.
 *
 * Registered globally as `APP_GUARD` (`SecurityModule`), the same way
 * `SessionAuthGuard` enforces sign-in — see that guard's own doc for why a
 * per-route opt-in kept getting forgotten. `app.module.ts` imports
 * `SessionModule` before `SecurityModule` deliberately, so an unauthenticated
 * flood against a session-only route gets rejected there first, before
 * spending a Valkey round-trip here; `rate-limit.integration-spec.ts` pins
 * that ordering rather than leaving it to import position alone.
 *
 * A route opts out entirely with `@SkipRateLimit()`, or overrides the
 * budget with `@RateLimit(...)` — on any verb, not just mutating ones, so
 * an explicit decision is never silently ignored. Absent either decorator,
 * a plain read (not in `MUTATING_METHODS`) is let through untouched; a
 * mutating request instead falls back to `DEFAULT_RATE_LIMIT`. That
 * fallback is a backstop, not the common path — every route that exists
 * today resolves through an explicit decision, one the
 * `require-rate-limit-decision` eslint rule already requires of every
 * mutating handler. It only fires for a future one that dodges that rule.
 */
@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly limiters = new Map<string, RateLimiterRedis>();

  constructor(
    @Inject(RATE_LIMIT_VALKEY_CLIENT)
    private readonly valkeyClient: RedisClientType,
    private readonly reflector: Reflector,
  ) {}

  async onModuleDestroy(): Promise<void> {
    // Nest resolves a guard referenced via @UseGuards() once per consuming
    // module even when its provider is global, so this hook can run more
    // than once against the same underlying client — guard against a
    // double quit() on an already-closed connection.
    if (this.valkeyClient.isOpen) {
      await this.valkeyClient.quit();
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip =
      this.reflector.get<boolean>(SKIP_RATE_LIMIT_KEY, context.getHandler()) ??
      this.reflector.get<boolean>(SKIP_RATE_LIMIT_KEY, context.getClass());
    if (skip) {
      return true;
    }

    const explicitOptions =
      this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_OPTIONS,
        context.getHandler(),
      ) ??
      this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_OPTIONS,
        context.getClass(),
      );

    const req = context.switchToHttp().getRequest<Request>();
    if (!explicitOptions && !MUTATING_METHODS.has(req.method)) {
      // No explicit budget and nothing to throttle by default — the same
      // scope require-rate-limit-decision already draws around what needs
      // a decision at all.
      return true;
    }

    const options = explicitOptions ?? DEFAULT_RATE_LIMIT;
    // Scopes every dimension's Valkey key to this handler — without it,
    // every route sharing the bare "ip:<ip>"/"id:<value>" key would consume
    // from the very same counter regardless of each route's own configured
    // budget (see the class doc's "per route" language, which the key
    // construction didn't actually honor before this).
    const routeKey = `${context.getClass().name}#${context.getHandler().name}`;
    for (const dimension of this.dimensions(req, options, routeKey)) {
      await this.checkDimension(dimension, options.durationSeconds);
    }
    return true;
  }

  /**
   * Independent throttle dimensions for this request: always the source
   * IP, plus the submitted identifier (e.g. email) when the route names
   * one — each with its own budget (see `ipPointsFor`), scoped to
   * `routeKey` so unrelated routes never share a counter. A single route
   * still checks both dimensions together (an attacker can't dodge one by
   * rotating the other), it's only cross-route sharing that's excluded.
   */
  private dimensions(
    req: Request,
    options: RateLimitOptions,
    routeKey: string,
  ): { key: string; points: number }[] {
    const dims = [
      {
        key: `${routeKey}:ip:${req.ip ?? 'unknown'}`,
        points: ipPointsFor(options),
      },
    ];
    const rawIdentifier = options.identifierField
      ? (req.body as Record<string, unknown> | undefined)?.[
          options.identifierField
        ]
      : undefined;
    if (typeof rawIdentifier === 'string' && rawIdentifier.length > 0) {
      dims.push({
        key: `${routeKey}:id:${rawIdentifier}`,
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
  private async lockOut(
    dimensionKey: string,
    durationSeconds: number,
  ): Promise<void> {
    const strikeKey = `rl:strikes:${dimensionKey}`;
    const strikes = await this.valkeyClient.incr(strikeKey);
    if (strikes === 1) {
      await this.valkeyClient.expire(strikeKey, STRIKE_RESET_SECONDS);
    }
    const blockSeconds = Math.min(
      MAX_BLOCK_SECONDS,
      durationSeconds * 2 ** (strikes - 1),
    );
    await this.valkeyClient.set(`rl:block:${dimensionKey}`, '1', {
      EX: blockSeconds,
    });
  }

  private tooManyRequests(): HttpException {
    return new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  private limiterFor(
    points: number,
    durationSeconds: number,
  ): RateLimiterRedis {
    const cacheKey = `${points}:${durationSeconds}`;
    let limiter = this.limiters.get(cacheKey);
    if (!limiter) {
      limiter = new RateLimiterRedis({
        storeClient: this.valkeyClient,
        useRedisPackage: true,
        keyPrefix: 'rl',
        points,
        duration: durationSeconds,
      });
      this.limiters.set(cacheKey, limiter);
    }
    return limiter;
  }
}
