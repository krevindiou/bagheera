<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\OperationRepository")
 * @ORM\Table(
 *  name="operation",
 *  indexes={@ORM\Index(name="external_operation_id_idx", columns={"external_operation_id"})},
 *  uniqueConstraints={@ORM\UniqueConstraint(name="operation_transfer_operation_id_unique", columns={"transfer_operation_id"})}
 * )
 */
class Operation
{
    use OperationTrait;

    /**
     * @var int
     *
     * @ORM\Column(name="operation_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $operationId;

    /**
     * @var string
     *
     * @ORM\Column(name="external_operation_id", type="string", length=32, nullable=true)
     */
    protected $externalOperationId;

    /**
     * @var Scheduler
     *
     * @ORM\ManyToOne(targetEntity="Scheduler", fetch="EAGER")
     * @ORM\JoinColumn(name="scheduler_id", referencedColumnName="scheduler_id")
     * @Assert\Type(type="App\Entity\Scheduler")
     * @Assert\Valid()
     */
    protected $scheduler;

    /**
     * @var Operation
     *
     * @ORM\OneToOne(targetEntity="Operation", cascade={"all"}, fetch="EAGER")
     * @ORM\JoinColumn(name="transfer_operation_id", referencedColumnName="operation_id", onDelete="SET NULL")
     * @Assert\Type(type="App\Entity\Operation")
     * @Assert\Valid()
     */
    protected $transferOperation;

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
