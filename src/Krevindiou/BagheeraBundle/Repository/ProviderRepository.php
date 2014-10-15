<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Repository;

use Doctrine\ORM\EntityRepository;
use Krevindiou\BagheeraBundle\Entity\Member;

class ProviderRepository extends EntityRepository
{
    public function getAvailableProvidersQueryBuilder(Member $member)
    {
        // Retrieve used providers
        $dql = 'SELECT p.providerId ';
        $dql.= 'FROM Model:Bank b ';
        $dql.= 'JOIN b.provider p ';
        $dql.= 'WHERE b.member = :member ';
        $dql.= 'AND b.provider IS NOT NULL ';
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);

        $providers = array_map('current', $query->getScalarResult());

        $qb = $this->createQueryBuilder('p')
                   ->where('p.country = :country')
                   ->orderBy('p.name', 'ASC')
                   ->setParameter('country', $member->getCountry());

        if (!empty($providers)) {
            $qb->andWhere('p.providerId NOT IN (' . implode(', ', $providers) . ')');
        }

        return $qb;
    }
}
