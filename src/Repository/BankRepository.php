<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Bank;
use App\Entity\Member;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Persistence\ManagerRegistry;

class BankRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Bank::class);
    }

    public function getList(Member $member, bool $activeOnly = true): ArrayCollection
    {
        $banks = [];

        $sql =<<<'EOT'
        SELECT (
          SELECT COALESCE(SUM(operation.credit), 0) - COALESCE(SUM(operation.debit), 0)
          FROM operation
          WHERE account.account_id = operation.account_id
        ) AS account_balance,
        bank.bank_id, bank.provider_id AS bank_provider_id, bank.name AS bank_name, bank.is_favorite AS bank_is_favorite, bank.is_closed AS bank_is_closed, bank.is_deleted AS bank_is_deleted,
        account.account_id, account.name AS account_name, account.currency AS account_currency, account.overdraft_facility AS account_overdraft_facility, account.is_deleted AS account_is_deleted
        FROM bank
        LEFT JOIN account ON bank.bank_id = account.bank_id AND account.is_deleted = false
        WHERE bank.member_id = :member_id
        AND bank.is_deleted = false
EOT;
        if ($activeOnly) {
            $sql .= ' AND bank.is_closed = false';
        }
        $sql .= ' ORDER BY bank.sort_order ASC, account.name ASC';

        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);
        $stmt->execute(
            [
                ':member_id' => $member->getMemberId(),
            ]
        );

        foreach ($stmt->fetchAll() as $row) {
            if (!isset($banks[$row['bank_id']])) {
                $banks[$row['bank_id']] = [
                    'bankId' => $row['bank_id'],
                    'name' => $row['bank_name'],
                    'favorite' => $row['bank_is_favorite'],
                    'closed' => $row['bank_is_closed'],
                    'deleted' => $row['bank_is_deleted'],
                    'active' => !$row['bank_is_deleted'] && !$row['bank_is_closed'],
                    'manual' => (null === $row['bank_provider_id']),
                    'accounts' => [],
                ];
            }

            if (isset($row['account_id'])) {
                $banks[$row['bank_id']]['accounts'][$row['account_id']] = [
                    'accountId' => $row['account_id'],
                    'name' => $row['account_name'],
                    'currency' => $row['account_currency'],
                    'overdraftFacility' => $row['account_overdraft_facility'],
                    'deleted' => $row['account_is_deleted'],
                    'balance' => $row['account_balance'],
                ];
            }
        }

        return new ArrayCollection($banks);
    }

    public function getActiveManualBanks(Member $member): ArrayCollection
    {
        $dql =<<<'EOT'
        SELECT b
        FROM App:Bank b
        WHERE b.member = :member
        AND b.deleted = false
        AND b.closed = false
        AND b.provider IS NULL
        ORDER BY b.name ASC
EOT;
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);

        return new ArrayCollection($query->getResult());
    }

    public function getActiveBanks(Member $member): ArrayCollection
    {
        $dql =<<<'EOT'
        SELECT b
        FROM App:Bank b
        WHERE b.member = :member
        AND b.deleted = false
        AND b.closed = false
        ORDER BY b.name ASC
EOT;
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);

        return new ArrayCollection($query->getResult());
    }
}
