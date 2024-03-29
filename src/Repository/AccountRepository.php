<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\Bank;
use App\Entity\Member;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;

class AccountRepository
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    public function getList(Member $member, Bank $bank = null, bool $deleted = true): ArrayCollection
    {
        $dql = <<<'EOT'
            SELECT a FROM App:Account a
            JOIN a.bank b
            WHERE b.member = :member
            EOT;
        if (null !== $bank) {
            $dql .= ' AND a.bank = :bank';
        }
        if (!$deleted) {
            $dql .= ' AND b.deleted = false';
            $dql .= ' AND a.deleted = false';
        }
        $dql .= ' ORDER BY a.name ASC';

        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('member', $member);
        if (null !== $bank) {
            $query->setParameter('bank', $bank);
        }

        return new ArrayCollection($query->getResult());
    }

    public function getBalance(Account $account, bool $reconciledOnly = false): int
    {
        $dql = <<<'EOT'
            SELECT (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS balance
            FROM App:Operation o
            WHERE o.account = :account
            EOT;
        if ($reconciledOnly) {
            $dql .= ' AND o.reconciled = true';
        }

        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('account', $account);
        $result = $query->getSingleResult();

        return $result['balance'];
    }

    public function getTransferableAccounts(Account $account): ArrayCollection
    {
        $dql = <<<'EOT'
            SELECT a
            FROM App:Account a
            JOIN a.bank b
            WHERE b.member = :member
            AND a != :account
            ORDER BY b.name ASC, a.name ASC
            EOT;
        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('member', $account->getBank()->getMember());
        $query->setParameter('account', $account);

        return new ArrayCollection($query->getResult());
    }

    public function getActiveAccounts(Member $member): ArrayCollection
    {
        $dql = <<<'EOT'
            SELECT a
            FROM App:Account a
            JOIN a.bank b
            WHERE b.member = :member
            AND b.deleted = false
            AND b.closed = false
            AND a.deleted = false
            ORDER BY b.name ASC, a.name ASC
            EOT;
        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('member', $member);

        return new ArrayCollection($query->getResult());
    }
}
