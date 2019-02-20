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
     * @var App\Entity\Scheduler
     *
     * @ORM\ManyToOne(targetEntity="Scheduler", fetch="EAGER")
     * @ORM\JoinColumn(name="scheduler_id", referencedColumnName="scheduler_id")
     * @Assert\Type(type="App\Entity\Scheduler")
     * @Assert\Valid()
     */
    protected $scheduler;

    /**
     * @var App\Entity\Account
     *
     * @ORM\ManyToOne(targetEntity="Account", inversedBy="operations")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Account")
     * @Assert\Valid()
     */
    protected $account;

    /**
     * @var App\Entity\Account
     *
     * @ORM\ManyToOne(targetEntity="Account", fetch="EAGER")
     * @ORM\JoinColumn(name="transfer_account_id", referencedColumnName="account_id")
     * @Assert\Type(type="App\Entity\Account")
     * @Assert\Valid()
     */
    protected $transferAccount;

    /**
     * @var App\Entity\Operation
     *
     * @ORM\OneToOne(targetEntity="Operation", cascade={"all"}, fetch="EAGER")
     * @ORM\JoinColumn(name="transfer_operation_id", referencedColumnName="operation_id", onDelete="SET NULL")
     * @Assert\Type(type="App\Entity\Operation")
     * @Assert\Valid()
     */
    protected $transferOperation;

    /**
     * @var App\Entity\Category
     *
     * @ORM\ManyToOne(targetEntity="Category", fetch="EAGER")
     * @ORM\JoinColumn(name="category_id", referencedColumnName="category_id")
     * @Assert\Type(type="App\Entity\Category")
     * @Assert\Valid()
     */
    protected $category;

    /**
     * @var App\Entity\PaymentMethod
     *
     * @ORM\ManyToOne(targetEntity="PaymentMethod")
     * @ORM\JoinColumn(name="payment_method_id", referencedColumnName="payment_method_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\PaymentMethod")
     * @Assert\Valid()
     */
    protected $paymentMethod;

    /**
     * @var string
     *
     * @ORM\Column(name="third_party", type="string", length=64)
     * @Assert\NotBlank()
     * @Assert\Length(max = 64)
     */
    protected $thirdParty;

    /**
     * @var float
     *
     * @ORM\Column(name="debit", type="decimal", scale=2, nullable=true)
     */
    protected $debit;

    /**
     * @var float
     *
     * @ORM\Column(name="credit", type="decimal", scale=2, nullable=true)
     */
    protected $credit;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="value_date", type="date")
     * @Assert\NotBlank()
     * @Assert\Type("DateTime")
     */
    protected $valueDate;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_reconciled", type="boolean", options={"default": false})
     * @Assert\Type("bool")
     */
    protected $reconciled = false;

    /**
     * @var string
     *
     * @ORM\Column(name="notes", type="text", nullable=true)
     */
    protected $notes;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="created_at", type="datetime")
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=true)
     */
    protected $updatedAt;

    public function __construct()
    {
        $this->setValueDate(new \DateTime());
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

    public function setTransferAccount(?Account $transferAccount): void
    {
        $this->transferAccount = $transferAccount;
    }

    public function getTransferAccount(): ?Account
    {
        return $this->transferAccount;
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

    public function setThirdParty(string $thirdParty): void
    {
        $this->thirdParty = $thirdParty;
    }

    public function getThirdParty(): ?string
    {
        return $this->thirdParty;
    }

    public function setDebit($debit = null): void
    {
        $this->debit = $debit;
    }

    public function getDebit()
    {
        return $this->debit;
    }

    public function setCredit($credit = null): void
    {
        $this->credit = $credit;
    }

    public function getCredit()
    {
        return $this->credit;
    }

    public function getAmount()
    {
        return (0 != $this->credit) ? $this->credit : -$this->debit;
    }

    public function setValueDate(?\DateTime $valueDate): void
    {
        $this->valueDate = $valueDate;
    }

    public function getValueDate(): ?\DateTime
    {
        return $this->valueDate;
    }

    public function setReconciled(bool $reconciled): void
    {
        $this->reconciled = $reconciled;
    }

    public function isReconciled(): ?bool
    {
        return $this->reconciled;
    }

    public function setNotes(string $notes): void
    {
        $this->notes = $notes;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }

    public function setAccount(Account $account): void
    {
        $this->account = $account;
    }

    public function getAccount(): ?Account
    {
        return $this->account;
    }

    public function setCategory(?Category $category): void
    {
        $this->category = $category;
    }

    public function getCategory(): ?Category
    {
        return $this->category;
    }

    public function setPaymentMethod(?PaymentMethod $paymentMethod): void
    {
        $this->paymentMethod = $paymentMethod;
    }

    public function getPaymentMethod(): ?PaymentMethod
    {
        return $this->paymentMethod;
    }

    public function setScheduler(?Scheduler $scheduler): void
    {
        $this->scheduler = $scheduler;
    }

    public function getScheduler(): ?Scheduler
    {
        return $this->scheduler;
    }
}
