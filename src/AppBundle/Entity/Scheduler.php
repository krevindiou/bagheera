<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity
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
     * @var AppBundle\Entity\Account
     *
     * @ORM\ManyToOne(targetEntity="Account", inversedBy="schedulers")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="AppBundle\Entity\Account")
     * @Assert\Valid()
     */
    protected $account;

    /**
     * @var AppBundle\Entity\Account
     *
     * @ORM\ManyToOne(targetEntity="Account", fetch="EAGER")
     * @ORM\JoinColumn(name="transfer_account_id", referencedColumnName="account_id")
     * @Assert\Type(type="AppBundle\Entity\Account")
     * @Assert\Valid()
     */
    protected $transferAccount;

    /**
     * @var AppBundle\Entity\Category
     *
     * @ORM\ManyToOne(targetEntity="Category", fetch="EAGER")
     * @ORM\JoinColumn(name="category_id", referencedColumnName="category_id")
     * @Assert\Type(type="AppBundle\Entity\Category")
     * @Assert\Valid()
     */
    protected $category;

    /**
     * @var AppBundle\Entity\PaymentMethod
     *
     * @ORM\ManyToOne(targetEntity="PaymentMethod")
     * @ORM\JoinColumn(name="payment_method_id", referencedColumnName="payment_method_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="AppBundle\Entity\PaymentMethod")
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
     * @Assert\DateTime()
     */
    protected $valueDate;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="limit_date", type="date", nullable=true)
     * @Assert\DateTime()
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

    /**
     * Get schedulerId.
     *
     * @return int
     */
    public function getSchedulerId()
    {
        return $this->schedulerId;
    }

    /**
     * Set thirdParty.
     *
     * @param string $thirdParty
     */
    public function setThirdParty($thirdParty)
    {
        $this->thirdParty = $thirdParty;
    }

    /**
     * Get thirdParty.
     *
     * @return string
     */
    public function getThirdParty()
    {
        return $this->thirdParty;
    }

    /**
     * Set debit.
     *
     * @param float $debit
     */
    public function setDebit($debit = null)
    {
        $this->debit = $debit;
    }

    /**
     * Get debit.
     *
     * @return float
     */
    public function getDebit()
    {
        return $this->debit;
    }

    /**
     * Set credit.
     *
     * @param float $credit
     */
    public function setCredit($credit = null)
    {
        $this->credit = $credit;
    }

    /**
     * Get credit.
     *
     * @return float
     */
    public function getCredit()
    {
        return $this->credit;
    }

    /**
     * Get credit or debit.
     *
     * @return float
     */
    public function getAmount()
    {
        return (0 != $this->credit) ? $this->credit : -$this->debit;
    }

    /**
     * Set valueDate.
     *
     * @param DateTime $valueDate
     */
    public function setValueDate(\DateTime $valueDate = null)
    {
        $this->valueDate = $valueDate;
    }

    /**
     * Get valueDate.
     *
     * @return DateTime
     */
    public function getValueDate()
    {
        return $this->valueDate;
    }

    /**
     * Set limitDate.
     *
     * @param DateTime $limitDate
     */
    public function setLimitDate(\DateTime $limitDate = null)
    {
        $this->limitDate = $limitDate;
    }

    /**
     * Get limitDate.
     *
     * @return DateTime
     */
    public function getLimitDate()
    {
        return $this->limitDate;
    }

    /**
     * Set reconciled.
     *
     * @param bool $reconciled
     */
    public function setReconciled($reconciled)
    {
        $this->reconciled = (bool) $reconciled;
    }

    /**
     * Get reconciled.
     *
     * @return bool
     */
    public function isReconciled()
    {
        return $this->reconciled;
    }

    /**
     * Set notes.
     *
     * @param string $notes
     */
    public function setNotes($notes)
    {
        $this->notes = $notes;
    }

    /**
     * Get notes.
     *
     * @return string
     */
    public function getNotes()
    {
        return $this->notes;
    }

    /**
     * Set frequencyUnit.
     *
     * @param string $frequencyUnit
     */
    public function setFrequencyUnit($frequencyUnit)
    {
        $this->frequencyUnit = $frequencyUnit;
    }

    /**
     * Get frequencyUnit.
     *
     * @return string
     */
    public function getFrequencyUnit()
    {
        return $this->frequencyUnit;
    }

    /**
     * Set frequencyValue.
     *
     * @param int $frequencyValue
     */
    public function setFrequencyValue($frequencyValue)
    {
        $this->frequencyValue = (int) $frequencyValue;
    }

    /**
     * Get frequencyValue.
     *
     * @return int
     */
    public function getFrequencyValue()
    {
        return $this->frequencyValue;
    }

    /**
     * Set active.
     *
     * @param bool $active
     */
    public function setActive($active)
    {
        $this->active = (bool) $active;
    }

    /**
     * Get active.
     *
     * @return bool
     */
    public function isActive()
    {
        return $this->active;
    }

    /**
     * Get createdAt.
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->createdAt;
    }

    /**
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }

    /**
     * Set account.
     *
     * @param AppBundle\Entity\Account $account
     */
    public function setAccount(Account $account)
    {
        $this->account = $account;
    }

    /**
     * Get account.
     *
     * @return AppBundle\Entity\Account
     */
    public function getAccount()
    {
        return $this->account;
    }

    /**
     * Set transferAccount.
     *
     * @param AppBundle\Entity\Account $transferAccount
     */
    public function setTransferAccount(Account $transferAccount = null)
    {
        $this->transferAccount = $transferAccount;
    }

    /**
     * Get transferAccount.
     *
     * @return AppBundle\Entity\Account
     */
    public function getTransferAccount()
    {
        return $this->transferAccount;
    }

    /**
     * Set category.
     *
     * @param AppBundle\Entity\Category $category
     */
    public function setCategory(Category $category = null)
    {
        $this->category = $category;
    }

    /**
     * Get category.
     *
     * @return AppBundle\Entity\Category
     */
    public function getCategory()
    {
        return $this->category;
    }

    /**
     * Set paymentMethod.
     *
     * @param AppBundle\Entity\PaymentMethod $paymentMethod
     */
    public function setPaymentMethod(PaymentMethod $paymentMethod = null)
    {
        $this->paymentMethod = $paymentMethod;
    }

    /**
     * Get paymentMethod.
     *
     * @return AppBundle\Entity\PaymentMethod
     */
    public function getPaymentMethod()
    {
        return $this->paymentMethod;
    }

    public function isOwner(Member $member)
    {
        return $this->getAccount()->getBank()->getMember()->getMemberId() == $member->getMemberId();
    }
}
