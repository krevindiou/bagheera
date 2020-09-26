<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Member;
use App\Entity\Provider;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Persistence\ManagerRegistry;

class ProviderRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Provider::class);
    }

    public function getAvailableProviders(Member $member): ArrayCollection
    {
        // Retrieve used providers
        $dql =<<<'EOT'
        SELECT p.providerId
        FROM App:Bank b
        JOIN b.provider p
        WHERE b.member = :member
        AND b.provider IS NOT NULL
EOT;
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
