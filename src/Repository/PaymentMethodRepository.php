<?php

declare(strict_types=1);

namespace App\Repository;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityRepository;

class PaymentMethodRepository extends EntityRepository
{
    public function getPaymentMethods(array $paymentMethodsId): ArrayCollection
    {
        $dql = 'SELECT p ';
        $dql .= 'FROM App:PaymentMethod p ';
        $dql .= 'WHERE p.paymentMethodId IN ('.implode(', ', $paymentMethodsId).') ';
        $query = $this->getEntityManager()->createQuery($dql);

        return new ArrayCollection($query->getResult());
    }
}
