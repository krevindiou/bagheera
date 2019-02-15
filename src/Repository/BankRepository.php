<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Member;
use Doctrine\ORM\EntityRepository;

class BankRepository extends EntityRepository
{
    public function getActiveManualBanksQueryBuilder(Member $member)
    {
        return $this->createQueryBuilder('b')
            ->where('b.member = :member')
            ->andWhere('b.deleted = false')
            ->andWhere('b.closed = false')
            ->andWhere('b.provider IS NULL')
            ->setParameter('member', $member)
            ->orderBy('b.name', 'ASC')
        ;
    }
}
