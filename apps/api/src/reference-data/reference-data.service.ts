import { Inject, Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { category, paymentMethod } from '../db/schema';
import { requireMemberId } from '../session/require-member-id';

@Injectable()
export class ReferenceDataService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  categories(req: Request) {
    requireMemberId(req);
    return this.db.select().from(category).orderBy(asc(category.name));
  }

  paymentMethods(req: Request) {
    requireMemberId(req);
    return this.db.select().from(paymentMethod).orderBy(asc(paymentMethod.id));
  }
}
