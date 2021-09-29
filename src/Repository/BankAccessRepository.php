<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BankAccess;
use Doctrine\ORM\EntityManagerInterface;

class BankAccessRepository
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    public function delete(BankAccess $bankAccess): void
    {
        $dql = <<<'EOT'
            DELETE FROM App:BankAccess b
            WHERE b.bankId = :bankId
            EOT;
        $query = $this->entityManager->createQuery($dql);
        $query->setParameter('bankId', $bankAccess->getBankId());
        $query->execute();
    }
}
