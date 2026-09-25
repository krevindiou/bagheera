import { Inject, Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { category, paymentMethod } from '../db/schema';

@Injectable()
export class ReferenceDataService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  categories() {
    return this.db.select().from(category).orderBy(asc(category.name));
  }

  paymentMethods() {
    return this.db.select().from(paymentMethod).orderBy(asc(paymentMethod.id));
  }
}
