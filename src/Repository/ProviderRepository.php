<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Member;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityRepository;

class ProviderRepository extends EntityRepository
{
    public function getAvailableProviders(Member $member): ArrayCollection
    {
        // Retrieve used providers
        $dql = 'SELECT p.providerId ';
        $dql .= 'FROM App:Bank b ';
        $dql .= 'JOIN b.provider p ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND b.provider IS NOT NULL ';
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);

        $providers = array_map('current', $query->getScalarResult());

        $qb = $this->createQueryBuilder('p')
            ->where('p.country = :country')
            ->orderBy('p.name', 'ASC')
            ->setParameter('country', $member->getCountry())
        ;

        if (!empty($providers)) {
            $qb->andWhere('p.providerId NOT IN ('.implode(', ', $providers).')');
        }

        return new ArrayCollection($qb->getQuery()->execute());
    }
}
