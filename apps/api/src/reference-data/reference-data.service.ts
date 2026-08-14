import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { category, paymentMethod } from '../db/schema';
import '../session/session-data';

@Injectable()
export class ReferenceDataService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  categories(req: Request) {
    this.requireMemberId(req);
    return this.db.select().from(category).orderBy(asc(category.name));
  }

  paymentMethods(req: Request) {
    this.requireMemberId(req);
    return this.db
      .select()
      .from(paymentMethod)
      .orderBy(asc(paymentMethod.id));
  }
}
