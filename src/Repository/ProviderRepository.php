<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Member;
use App\Entity\Provider;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Criteria;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;

class ProviderRepository
{
    /**
     * @var EntityRepository<Provider>
     */
    private EntityRepository $repository;

    public function __construct(private EntityManagerInterface $entityManager)
    {
        $this->repository = $entityManager->getRepository(Provider::class);
    }

    public function getAvailableProviders(Member $member): ArrayCollection
    {
        // Retrieve used providers
        $dql = <<<'EOT'
            SELECT p.providerId
            FROM App:Bank b
            JOIN b.provider p
            WHERE b.member = :member
            AND b.provider IS NOT NULL
            EOT;
        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('member', $member);

        $providers = array_map('current', $query->getScalarResult());

        $qb = $this->repository->createQueryBuilder('p')
            ->where('p.country = :country')
            ->orderBy('p.name', Criteria::ASC)
            ->setParameter('country', $member->getCountry())
        ;

        if (!empty($providers)) {
            $qb->andWhere('p.providerId NOT IN ('.implode(', ', $providers).')');
        }

        return new ArrayCollection($qb->getQuery()->execute());
    }
}
