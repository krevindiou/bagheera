<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BankAccess;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class BankAccessRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, BankAccess::class);
    }

    public function delete(BankAccess $bankAccess): void
    {
        $dql = <<<'EOT'
                    DELETE FROM App:BankAccess b
                    WHERE b.bankId = :bankId
            EOT;
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('bankId', $bankAccess->getBankId());
        $query->execute();
    }
}
