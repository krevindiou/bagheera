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
  RATE_LIMIT_OPTIONS,
  RateLimitOptions,
} from './rate-limit.constants';
import { RATE_LIMIT_VALKEY_CLIENT } from './rate-limit-valkey-client.provider';

/**
 * Valkey-backed request throttling. Key = `<identifier>:<source IP>`, so
 * distinct identifiers (and distinct IPs) are tracked independently —
 * one throttled caller doesn't affect another.
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
    const key = this.buildKey(req, options);
    const limiter = this.limiterFor(options);

    try {
      await limiter.consume(key);
      return true;
    } catch (rejection) {
      if (rejection instanceof Error) {
        throw rejection;
      }
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private buildKey(req: Request, options: RateLimitOptions): string {
    const rawIdentifier = options.identifierField
      ? (req.body as Record<string, unknown> | undefined)?.[
          options.identifierField
        ]
      : undefined;
    const identifier =
      typeof rawIdentifier === 'string' && rawIdentifier.length > 0
        ? rawIdentifier
        : '*';
    return `${identifier}:${req.ip ?? 'unknown'}`;
  }

  private limiterFor(options: RateLimitOptions): RateLimiterRedis {
    const cacheKey = `${options.points}:${options.durationSeconds}`;
    let limiter = this.limiters.get(cacheKey);
    if (!limiter) {
      limiter = new RateLimiterRedis({
        storeClient: this.valkeyClient,
        useRedisPackage: true,
        keyPrefix: 'rl',
        points: options.points,
        duration: options.durationSeconds,
      });
      this.limiters.set(cacheKey, limiter);
    }
    return limiter;
  }
}
