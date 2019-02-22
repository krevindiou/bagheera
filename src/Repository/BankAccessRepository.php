<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BankAccess;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Symfony\Bridge\Doctrine\RegistryInterface;

class BankAccessRepository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, BankAccess::class);
    }

    public function delete(BankAccess $bankAccess): void
    {
        $dql = 'DELETE FROM App:BankAccess b ';
        $dql .= 'WHERE b.bankId = :bankId ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('bankId', $bankAccess->getBankId());
        $query->execute();
    }
}
