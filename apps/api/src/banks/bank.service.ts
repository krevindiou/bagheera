import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { bank } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { ChooseBankDto } from './dto/choose-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

export interface ChooseBankResult {
  id: number;
  name: string;
  created: boolean;
}

@Injectable()
export class BankService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
    private readonly audit: AuditService,
    private readonly ownership: OwnershipService,
  ) {}

  async list(req: Request) {
    const memberId = requireMemberId(req);
    return this.db
      .select()
      .from(bank)
      .where(and(eq(bank.memberId, memberId), eq(bank.deleted, false)))
      .orderBy(asc(bank.name));
  }

  async choose(req: Request, dto: ChooseBankDto): Promise<ChooseBankResult> {
    const memberId = requireMemberId(req);

    if ((!dto.bankId && !dto.name) || (dto.bankId && dto.name)) {
      throw new BadRequestException('You must select a bank.');
    }

    if (dto.bankId) {
      const row = await this.ownership.requireOwnedBank(dto.bankId, memberId);
      if (row.closed || row.deleted) {
        throw new UnprocessableEntityException('Bank is not active.');
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
    const memberId = requireMemberId(req);
    const row = await this.ownership.requireOwnedBank(id, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Bank is not active.');
    }
    await this.db.update(bank).set({ name: dto.name }).where(eq(bank.id, id));
  }

  async close(req: Request, id: number): Promise<void> {
    const memberId = requireMemberId(req);
    const row = await this.ownership.requireOwnedBank(id, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Bank is not active.');
    }
    await this.db.update(bank).set({ closed: true }).where(eq(bank.id, id));
    await this.audit.record('bank_closed', memberId, req.ip ?? 'unknown');
  }

  async remove(req: Request, id: number): Promise<void> {
    const memberId = requireMemberId(req);
    const row = await this.ownership.requireOwnedBank(id, memberId);
    if (row.deleted) {
      throw new UnprocessableEntityException('Bank is already deleted.');
    }
    await this.db.transaction(async (tx) => {
      await tx.update(bank).set({ deleted: true }).where(eq(bank.id, id));
      // Other accounts' transfer references pointing at any of this bank's
      // accounts convert to the External placeholder, irreversibly.
      await this.transfers.convertBankReferencesToExternal(tx, id);
    });
    await this.audit.record('bank_deleted', memberId, req.ip ?? 'unknown');
  }
}
