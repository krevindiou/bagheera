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
import { toMinorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import '../session/session-data';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

// Payment method id 9, "Initial balance", reserved for the
// system-generated opening operation.
const INITIAL_BALANCE_PAYMENT_METHOD_ID = 9;

@Injectable()
export class AccountService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
  ) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  // Ownership check always runs before any lifecycle-state check.
  // An account of a deleted bank is unreachable — "not found" — even for
  // the owner, so the bank's `deleted` flag is folded into the
  // same not-found branch here rather than treated as an owner-visible
  // access-denied error.
  private async findOwned(id: number, memberId: number) {
    const [row] = await this.db
      .select({ account, bank })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(account.id, id));
    if (!row || row.bank.memberId !== memberId || row.bank.deleted) {
      throw new NotFoundException();
    }
    return row;
  }

  private async requireActiveOwnedBank(bankId: number, memberId: number) {
    const [row] = await this.db.select().from(bank).where(eq(bank.id, bankId));
    if (!row || row.memberId !== memberId) {
      throw new NotFoundException();
    }
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Bank is not active.');
    }
    return row;
  }

  async list(req: Request, bankId?: number) {
    const memberId = this.requireMemberId(req);
    const conditions = [
      eq(bank.memberId, memberId),
      eq(bank.deleted, false),
      eq(account.deleted, false),
    ];
    if (bankId) {
      conditions.push(eq(account.bankId, bankId));
    }
    const rows = await this.db
      .select({ account })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(and(...conditions))
      .orderBy(asc(account.name));
    return rows.map((r) => r.account);
  }

  async create(req: Request, dto: CreateAccountDto) {
    const memberId = this.requireMemberId(req);
    await this.requireActiveOwnedBank(dto.bankId, memberId);

    const [created] = await this.db
      .insert(account)
      .values({
        bankId: dto.bankId,
        name: dto.name,
        currency: dto.currency,
      })
      .returning();

    const minorUnits = toMinorUnits(dto.initialBalance ?? 0);
    if (minorUnits !== 0) {
      await this.db.insert(operation).values({
        accountId: created.id,
        paymentMethodId: INITIAL_BALANCE_PAYMENT_METHOD_ID,
        thirdParty: 'Initial balance',
        credit: minorUnits > 0 ? minorUnits : null,
        debit: minorUnits < 0 ? -minorUnits : null,
        reconciled: true,
      });
    }

    return created;
  }

  async update(req: Request, id: number, dto: UpdateAccountDto): Promise<void> {
    const memberId = this.requireMemberId(req);
    const { account: row } = await this.findOwned(id, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Account is not active.');
    }
    if (dto.bankId !== row.bankId || dto.currency !== row.currency) {
      throw new BadRequestException('Bank and currency cannot be changed.');
    }
    await this.db
      .update(account)
      .set({ name: dto.name })
      .where(eq(account.id, id));
  }

  async close(req: Request, id: number): Promise<void> {
    const memberId = this.requireMemberId(req);
    const { account: row } = await this.findOwned(id, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Account is not active.');
    }
    await this.db
      .update(account)
      .set({ closed: true })
      .where(eq(account.id, id));
  }

  async remove(req: Request, id: number): Promise<void> {
    const memberId = this.requireMemberId(req);
    const { account: row } = await this.findOwned(id, memberId);
    if (row.deleted) {
      throw new UnprocessableEntityException('Account is already deleted.');
    }
    await this.db.transaction(async (tx) => {
      await tx.update(account).set({ deleted: true }).where(eq(account.id, id));
      // Other accounts' transfer references pointing at this one convert
      // to the External placeholder, irreversibly, at deletion time.
      await this.transfers.convertAccountReferencesToExternal(tx, id);
    });
  }
}
