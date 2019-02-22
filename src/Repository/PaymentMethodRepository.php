<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PaymentMethod;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Bridge\Doctrine\RegistryInterface;

class PaymentMethodRepository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, PaymentMethod::class);
    }

    public function getPaymentMethods(array $paymentMethodsId): ArrayCollection
    {
        $dql = 'SELECT p ';
        $dql .= 'FROM App:PaymentMethod p ';
        $dql .= 'WHERE p.paymentMethodId IN ('.implode(', ', $paymentMethodsId).') ';
        $query = $this->getEntityManager()->createQuery($dql);

        return new ArrayCollection($query->getResult());
    }
}
