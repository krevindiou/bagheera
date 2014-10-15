<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Repository;

use Doctrine\ORM\EntityRepository;
use Krevindiou\BagheeraBundle\Entity\Member;

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
                    ->orderBy('b.name', 'ASC');
    }
}
