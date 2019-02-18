<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\Bank;
use App\Entity\Member;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityRepository;

class AccountRepository extends EntityRepository
{
    public function getList(Member $member, Bank $bank = null, bool $deleted = true): ArrayCollection
    {
        $dql = 'SELECT a FROM App:Account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        if (null !== $bank) {
            $dql .= 'AND a.bank = :bank ';
        }
        if (!$deleted) {
            $dql .= 'AND b.deleted = false ';
            $dql .= 'AND a.deleted = false ';
        }
        $dql .= 'ORDER BY a.name ASC';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);
        if (null !== $bank) {
            $query->setParameter('bank', $bank);
        }

        return new ArrayCollection($query->getResult());
    }

    public function getBalance(Account $account, bool $reconciledOnly = false): string
    {
        $dql = 'SELECT (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS balance ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = :account ';
        if ($reconciledOnly) {
            $dql .= 'AND o.reconciled = true ';
        }

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('account', $account);
        $result = $query->getSingleResult();

        return sprintf('%.2f', $result['balance']);
    }

    public function getTransferableAccounts(Account $account): ArrayCollection
    {
        $dql = 'SELECT a ';
        $dql .= 'FROM App:Account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND a != :account ';
        $dql .= 'ORDER BY b.name ASC, a.name ASC ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $account->getBank()->getMember());
        $query->setParameter('account', $account);

        return new ArrayCollection($query->getResult());
    }

    public function getActiveAccounts(Member $member): ArrayCollection
    {
        $dql = 'SELECT a ';
        $dql .= 'FROM App:Account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND b.deleted = false ';
        $dql .= 'AND b.closed = false ';
        $dql .= 'AND a.deleted = false ';
        $dql .= 'ORDER BY b.name ASC, a.name ASC ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);

        return new ArrayCollection($query->getResult());
    }
}
