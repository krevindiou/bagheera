<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\SchedulerRepository")
 * @ORM\Table(name="scheduler")
 */
class Scheduler
{
    /**
     * @var int
     *
     * @ORM\Column(name="scheduler_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $schedulerId;

    /**
     * @var App\Entity\Account
     *
     * @ORM\ManyToOne(targetEntity="Account", inversedBy="schedulers")
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
     * @ORM\Column(name="third_party", type="string", length=64, nullable=false)
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
     * @ORM\Column(name="value_date", type="date", nullable=false)
     * @Assert\NotBlank()
     * @Assert\Type("DateTime")
     */
    protected $valueDate;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="limit_date", type="date", nullable=true)
     * @Assert\Type("DateTime")
     */
    protected $limitDate;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_reconciled", type="boolean", nullable=false)
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
     * @var string
     *
     * @ORM\Column(name="frequency_unit", type="string", length=16, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"day", "week", "month", "year"})
     */
    protected $frequencyUnit = 'month';

    /**
     * @var int
     *
     * @ORM\Column(name="frequency_value", type="smallint", nullable=false)
     * @Assert\NotBlank()
     * @Assert\Type("integer")
     */
    protected $frequencyValue;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_active", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $active = true;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     */
    protected $updatedAt;

    public function getSchedulerId(): ?int
    {
        return $this->schedulerId;
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

    public function setLimitDate(?\DateTime $limitDate): void
    {
        $this->limitDate = $limitDate;
    }

    public function getLimitDate(): ?\DateTime
    {
        return $this->limitDate;
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

    public function setFrequencyUnit(string $frequencyUnit): void
    {
        $this->frequencyUnit = $frequencyUnit;
    }

    public function getFrequencyUnit(): ?string
    {
        return $this->frequencyUnit;
    }

    public function setFrequencyValue(int $frequencyValue): void
    {
        $this->frequencyValue = $frequencyValue;
    }

    public function getFrequencyValue(): ?int
    {
        return $this->frequencyValue;
    }

    public function setActive(bool $active): void
    {
        $this->active = $active;
    }

    public function isActive(): ?bool
    {
        return $this->active;
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

    public function isOwner(Member $member): bool
    {
        return $this->getAccount()->getBank()->getMember()->getMemberId() === $member->getMemberId();
    }
}
