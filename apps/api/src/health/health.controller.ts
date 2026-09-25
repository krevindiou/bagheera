import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { RedisClientType } from 'redis';
import { DRIZZLE } from '../db/db.constants';
import { Public } from '../session/public.decorator';
import { VALKEY_CLIENT } from '../session/session.constants';
import { HealthResponseDto } from './dto/health-response.dto';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    @Inject(VALKEY_CLIENT) private readonly valkey: RedisClientType,
  ) {}

  @Get()
  async check(): Promise<HealthResponseDto> {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException('database unreachable');
    }
    try {
      await this.valkey.ping();
    } catch {
      throw new ServiceUnavailableException('valkey unreachable');
    }
    return { status: 'ok' };
  }
}
