<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\Index;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\ManyToOne;
use Doctrine\ORM\Mapping\OneToOne;
use Doctrine\ORM\Mapping\Table;
use Doctrine\ORM\Mapping\UniqueConstraint;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'operation')]
#[Index(name: 'external_operation_id_idx', columns: ['external_operation_id'])]
#[UniqueConstraint(name: 'operation_transfer_operation_id_unique', columns: ['transfer_operation_id'])]
class Operation
{
    use OperationTrait;

    #[Assert\NotNull]
    #[Assert\Type(type: Account::class)]
    #[ManyToOne(targetEntity: Account::class, inversedBy: 'operations')]
    #[JoinColumn(name: 'account_id', referencedColumnName: 'account_id', nullable: false)]
    private Account $account;

    #[Id, Column(name: 'operation_id', type: Types::INTEGER)]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $operationId = null;

    #[Column(name: 'external_operation_id', type: Types::STRING, length: 32, nullable: true)]
    private ?string $externalOperationId = null;

    #[Assert\Type(type: Scheduler::class)]
    #[ManyToOne(targetEntity: Scheduler::class, fetch: 'EAGER')]
    #[JoinColumn(name: 'scheduler_id', referencedColumnName: 'scheduler_id')]
    private ?Scheduler $scheduler = null;

    #[Assert\Type(type: self::class)]
    #[Assert\Valid]
    #[OneToOne(targetEntity: self::class, cascade: ['all'], fetch: 'EAGER')]
    #[JoinColumn(name: 'transfer_operation_id', referencedColumnName: 'operation_id', onDelete: 'SET NULL')]
    private ?Operation $transferOperation;

    public function __construct()
    {
        $this->setValueDate(new \DateTime());
    }

    public function setOperationId(?int $operationId): void
    {
        $this->operationId = $operationId;
    }

    public function getOperationId(): ?int
    {
        return $this->operationId;
    }

    public function setExternalOperationId(string $externalOperationId): void
    {
        $this->externalOperationId = $externalOperationId;
    }

    public function getExternalOperationId(): ?string
    {
        return $this->externalOperationId;
    }

    public function setScheduler(?Scheduler $scheduler): void
    {
        $this->scheduler = $scheduler;
    }

    public function getScheduler(): ?Scheduler
    {
        return $this->scheduler;
    }

    public function setTransferOperation(?self $transferOperation): void
    {
        if (null !== $transferOperation) {
            if (null !== $transferOperation->getAccount()) {
                $this->setTransferAccount($transferOperation->getAccount());
            }
        } else {
            $this->setTransferAccount(null);
        }

        $this->transferOperation = $transferOperation;
    }

    public function getTransferOperation(): ?self
    {
        return $this->transferOperation;
    }

    public function getAmount()
    {
        return (null !== $this->credit) ? $this->credit : -$this->debit;
    }
}
