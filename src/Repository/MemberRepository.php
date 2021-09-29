<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Member;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;

class MemberRepository
{
    /**
     * @var EntityRepository<Member>
     */
    private EntityRepository $repository;

    public function __construct(EntityManagerInterface $entityManager)
    {
        $this->repository = $entityManager->getRepository(Member::class);
    }

    public function findOneByEmail(string $email): Member
    {
        return $this->repository->findOneBy(['email' => $email]);
    }
}
