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

// Strikes (lockout violations) decay after an hour of no further
// violations on that dimension, so a stale block count doesn't keep
// escalating a caller's lockout indefinitely.
const STRIKE_RESET_SECONDS = 3600;
// Cap on how long a single lockout can run, how ever many strikes accrue.
const MAX_BLOCK_SECONDS = 3600;

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
    const options =
      this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_OPTIONS,
        context.getHandler(),
      ) ??
      this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_OPTIONS,
        context.getClass(),
      ) ??
      DEFAULT_RATE_LIMIT;

    const req = context.switchToHttp().getRequest<Request>();
    for (const dimension of this.dimensions(req, options)) {
      await this.checkDimension(dimension, options.durationSeconds);
    }
    return true;
  }

  /**
   * Independent throttle dimensions for this request: always the source
   * IP, plus the submitted identifier (e.g. email) when the route names
   * one — each with its own budget (see `ipPointsFor`).
   */
  private dimensions(
    req: Request,
    options: RateLimitOptions,
  ): { key: string; points: number }[] {
    const dims = [
      { key: `ip:${req.ip ?? 'unknown'}`, points: ipPointsFor(options) },
    ];
    const rawIdentifier = options.identifierField
      ? (req.body as Record<string, unknown> | undefined)?.[
          options.identifierField
        ]
      : undefined;
    if (typeof rawIdentifier === 'string' && rawIdentifier.length > 0) {
      dims.push({ key: `id:${rawIdentifier}`, points: options.points });
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
