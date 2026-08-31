import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { Public } from '../session/public.decorator';

@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  @Get()
  async check() {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException('database unreachable');
    }
    return { status: 'ok' };
  }
}
