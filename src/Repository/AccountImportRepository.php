<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\AccountImport;
use App\Entity\Member;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Symfony\Bridge\Doctrine\RegistryInterface;

class AccountImportRepository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, AccountImport::class);
    }

    public function getNextImportId(Account $account): int
    {
        $dql = 'SELECT MAX(i.importId) ';
        $dql .= 'FROM App:AccountImport i ';
        $dql .= 'JOIN i.account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND i.finished = true ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $account->getBank()->getMember());

        return (int) $query->getSingleScalarResult() + 1;
    }

    public function getImportProgress(Member $member): ?array
    {
        // Fetch current importId
        $dql = 'SELECT MAX(i.importId) ';
        $dql .= 'FROM App:AccountImport i ';
        $dql .= 'JOIN i.account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND i.finished = false ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);

        try {
            $maxImportId = $query->getSingleScalarResult();
        } catch (\Exception $e) {
            return null;
        }

        $dql = 'SELECT i ';
        $dql .= 'FROM App:AccountImport i INDEX BY i.accountId ';
        $dql .= 'WHERE i.importId = :maxImportId ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('maxImportId', $maxImportId);

        try {
            return $query->getResult();
        } catch (\Exception $e) {
            return null;
        }
    }
}
