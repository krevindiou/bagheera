import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type IORedis from 'ioredis';
import { errorMessage } from '../common/error-message';
import { DRIZZLE } from '../db/db.constants';
import { Public } from '../session/public.decorator';
import { VALKEY_CLIENT } from '../session/session.constants';
import { HealthResponseDto } from './dto/health-response.dto';

@Controller('health')
@Public()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    @Inject(VALKEY_CLIENT) private readonly valkey: IORedis,
  ) {}

  @Get()
  async check(): Promise<HealthResponseDto> {
    try {
      await this.db.execute(sql`select 1`);
    } catch (err) {
      this.logger.error(`database probe failed: ${errorMessage(err)}`);
      throw new ServiceUnavailableException('database unreachable');
    }
    try {
      await this.valkey.ping();
    } catch (err) {
      this.logger.error(`valkey probe failed: ${errorMessage(err)}`);
      throw new ServiceUnavailableException('valkey unreachable');
    }
    return { status: 'ok' };
  }
}
