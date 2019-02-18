<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BankAccess;
use Doctrine\ORM\EntityRepository;

class BankAccessRepository extends EntityRepository
{
    public function delete(BankAccess $bankAccess): void
    {
        $dql = 'DELETE FROM App:BankAccess b ';
        $dql .= 'WHERE b.bankId = :bankId ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('bankId', $bankAccess->getBankId());
        $query->execute();
    }
}
