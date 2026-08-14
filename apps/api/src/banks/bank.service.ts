import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { bank } from '../db/schema';
import '../session/session-data';
import { ChooseBankDto } from './dto/choose-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

export interface ChooseBankResult {
  id: number;
  name: string;
  created: boolean;
}

@Injectable()
export class BankService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  // Fetches by id first (ignoring owner) so the ownership check always runs
  // ahead of any lifecycle-state check: a non-owner gets "not found"
  // even when the bank is also closed/deleted.
  private async findOwned(id: number, memberId: number) {
    const [row] = await this.db.select().from(bank).where(eq(bank.id, id));
    if (!row || row.memberId !== memberId) {
      throw new NotFoundException();
    }
    return row;
  }

  async list(req: Request) {
    const memberId = this.requireMemberId(req);
    return this.db
      .select()
      .from(bank)
      .where(and(eq(bank.memberId, memberId), eq(bank.deleted, false)))
      .orderBy(asc(bank.name));
  }

  async choose(req: Request, dto: ChooseBankDto): Promise<ChooseBankResult> {
    const memberId = this.requireMemberId(req);

    if ((!dto.bankId && !dto.name) || (dto.bankId && dto.name)) {
      throw new BadRequestException('You must select a bank.');
    }

    if (dto.bankId) {
      const [row] = await this.db
        .select()
        .from(bank)
        .where(eq(bank.id, dto.bankId));
      if (!row || row.memberId !== memberId || row.closed || row.deleted) {
        throw new NotFoundException();
      }
      return { id: row.id, name: row.name, created: false };
    }

    const [created] = await this.db
      .insert(bank)
      .values({ memberId, name: dto.name! })
      .returning();
    return { id: created.id, name: created.name, created: true };
  }

  async update(req: Request, id: number, dto: UpdateBankDto): Promise<void> {
    const memberId = this.requireMemberId(req);
    const row = await this.findOwned(id, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Bank is not active.');
    }
    await this.db.update(bank).set({ name: dto.name }).where(eq(bank.id, id));
  }

  async close(req: Request, id: number): Promise<void> {
    const memberId = this.requireMemberId(req);
    const row = await this.findOwned(id, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Bank is not active.');
    }
    await this.db.update(bank).set({ closed: true }).where(eq(bank.id, id));
  }

  async remove(req: Request, id: number): Promise<void> {
    const memberId = this.requireMemberId(req);
    const row = await this.findOwned(id, memberId);
    if (row.deleted) {
      throw new UnprocessableEntityException('Bank is already deleted.');
    }
    // Real transfer-reference conversion to "External account" for the
    // bank's accounts lands with transfers later; this is a plain
    // soft-delete for now.
    await this.db.update(bank).set({ deleted: true }).where(eq(bank.id, id));
  }
}
