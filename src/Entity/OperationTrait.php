<?php

declare(strict_types=1);

namespace App\Entity;

trait OperationTrait
{
    /**
     * @var Account
     *
     * @ORM\ManyToOne(targetEntity="Account", inversedBy="operations")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Account")
     * @Assert\Valid()
     */
    protected $account;

    /**
     * @var Account
     *
     * @ORM\ManyToOne(targetEntity="Account", fetch="EAGER")
     * @ORM\JoinColumn(name="transfer_account_id", referencedColumnName="account_id")
     * @Assert\Type(type="App\Entity\Account")
     * @Assert\Valid()
     */
    protected $transferAccount;

    /**
     * @var Category
     *
     * @ORM\ManyToOne(targetEntity="Category", fetch="EAGER")
     * @ORM\JoinColumn(name="category_id", referencedColumnName="category_id")
     * @Assert\Type(type="App\Entity\Category")
     * @Assert\Valid()
     */
    protected $category;

    /**
     * @var PaymentMethod
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
     * @var int
     *
     * @ORM\Column(name="debit", type="integer", nullable=true)
     */
    protected $debit;

    /**
     * @var int
     *
     * @ORM\Column(name="credit", type="integer", nullable=true)
     */
    protected $credit;

    /**
     * @var \DateTime
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
     * @var \DateTime
     *
     * @ORM\Column(name="created_at", type="datetime")
     */
    protected $createdAt;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=true)
     */
    protected $updatedAt;

    public function setAccount(Account $account): void
    {
        $this->account = $account;
    }

    public function getAccount(): ?Account
    {
        return $this->account;
    }

    public function setTransferAccount(?Account $transferAccount): void
    {
        $this->transferAccount = $transferAccount;
    }

    public function getTransferAccount(): ?Account
    {
        return $this->transferAccount;
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

    public function setThirdParty(string $thirdParty): void
    {
        $this->thirdParty = $thirdParty;
    }

    public function getThirdParty(): ?string
    {
        return $this->thirdParty;
    }

    public function setDebit(?int $debit): void
    {
        if (null !== $debit) {
            $this->credit = null;
        }

        $this->debit = $debit;
    }

    public function getDebit(): ?int
    {
        return $this->debit;
    }

    public function setCredit(?int $credit): void
    {
        if (null !== $credit) {
            $this->debit = null;
        }

        $this->credit = $credit;
    }

    public function getCredit(): ?int
    {
        return $this->credit;
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

    public function setNotes(?string $notes): void
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
}
