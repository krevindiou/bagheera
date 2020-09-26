<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PaymentMethod;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Persistence\ManagerRegistry;

class PaymentMethodRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PaymentMethod::class);
    }

    public function getList(): ArrayCollection
    {
        return new ArrayCollection($this->findAll());
    }

    public function getPaymentMethods(array $paymentMethodsId): ArrayCollection
    {
        $dql =<<<'EOT'
        SELECT p
        FROM App:PaymentMethod p
        WHERE p.paymentMethodId IN (%s)
EOT;
        $query = $this->getEntityManager()->createQuery(sprintf($dql, implode(', ', $paymentMethodsId)));

        return new ArrayCollection($query->getResult());
    }
}
