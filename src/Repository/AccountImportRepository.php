<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\AccountImport;
use App\Entity\Member;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class AccountImportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AccountImport::class);
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
        $query = $this->getEntityManager()->createQuery($dql);
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
        $query = $this->getEntityManager()->createQuery($dql);
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
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('maxImportId', $maxImportId);

        try {
            return $query->getResult();
        } catch (\Exception $e) {
            return null;
        }
    }
}
