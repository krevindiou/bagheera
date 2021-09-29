<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\AccountImport;
use App\Entity\Member;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;

class AccountImportRepository
{
    private EntityManagerInterface $entityManager;

    /**
     * @var EntityRepository<AccountImport>
     */
    private EntityRepository $repository;

    public function __construct(EntityManagerInterface $entityManager)
    {
        $this->entityManager = $entityManager;
        $this->repository = $entityManager->getRepository(AccountImport::class);
    }

    public function getNextImportId(Account $account): int
    {
        $dql = <<<'EOT'
            SELECT MAX(i.importId)
            FROM App:AccountImport i
            JOIN i.account a
            JOIN a.bank b
            WHERE b.member = :member
            AND i.finished = true
            EOT;
        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('member', $account->getBank()->getMember());

        return (int) $query->getSingleScalarResult() + 1;
    }

    public function getImportProgress(Member $member): ?array
    {
        // Fetch current importId
        $dql = <<<'EOT'
            SELECT MAX(i.importId)
            FROM App:AccountImport i
            JOIN i.account a
            JOIN a.bank b
            WHERE b.member = :member
            AND i.finished = false
            EOT;
        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('member', $member);

        try {
            $maxImportId = $query->getSingleScalarResult();
        } catch (\Exception $e) {
            return null;
        }

        $dql = <<<'EOT'
            SELECT i
            FROM App:AccountImport i INDEX BY i.accountId
            WHERE i.importId = :maxImportId
            EOT;
        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('maxImportId', $maxImportId);

        try {
            return $query->getResult();
        } catch (\Exception $e) {
            return null;
        }
    }

    public function findOneByAccount(Account $account): AccountImport
    {
        return $this->repository->findOneBy(
            [
                'account' => $account->getAccountId(),
                'finished' => 0,
            ]
        );
    }
}
