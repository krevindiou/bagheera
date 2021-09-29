<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PaymentMethod;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;

class PaymentMethodRepository
{
    private EntityManagerInterface $entityManager;

    /**
     * @var EntityRepository<PaymentMethod>
     */
    private EntityRepository $repository;

    public function __construct(EntityManagerInterface $entityManager)
    {
        $this->entityManager = $entityManager;
        $this->repository = $entityManager->getRepository(PaymentMethod::class);
    }

    public function getList(): ArrayCollection
    {
        return new ArrayCollection($this->repository->findAll());
    }

    public function getPaymentMethods(array $paymentMethodsId): ArrayCollection
    {
        $dql = <<<'EOT'
            SELECT p
            FROM App:PaymentMethod p
            WHERE p.paymentMethodId IN (%s)
            EOT;
        $query = $this->entityManager->createQuery(sprintf($dql, implode(', ', $paymentMethodsId)));

        return new ArrayCollection($query->getResult());
    }
}
