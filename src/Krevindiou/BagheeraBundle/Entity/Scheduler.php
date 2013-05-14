<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity
 * @ORM\Table(name="scheduler")
 * @ORM\HasLifecycleCallbacks()
 */
class Scheduler
{
    /**
     * @var integer $schedulerId
     *
     * @ORM\Column(name="scheduler_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $schedulerId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Account $account
     *
     * @ORM\ManyToOne(targetEntity="Account", inversedBy="schedulers")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @Assert\NotBlank()
     * @Assert\Valid()
     */
    protected $account;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Account $transferAccount
     *
     * @ORM\ManyToOne(targetEntity="Account", fetch="EAGER")
     * @ORM\JoinColumn(name="transfer_account_id", referencedColumnName="account_id")
     * @Assert\Valid()
     */
    protected $transferAccount;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Category $category
     *
     * @ORM\ManyToOne(targetEntity="Category", fetch="EAGER")
     * @ORM\JoinColumn(name="category_id", referencedColumnName="category_id")
     * @Assert\Valid()
     */
    protected $category;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\PaymentMethod $paymentMethod
     *
     * @ORM\ManyToOne(targetEntity="PaymentMethod")
     * @ORM\JoinColumn(name="payment_method_id", referencedColumnName="payment_method_id", nullable=false)
     * @Assert\NotBlank()
     * @Assert\Valid()
     */
    protected $paymentMethod;

    /**
     * @var string $thirdParty
     *
     * @ORM\Column(name="third_party", type="string", length=64, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Length(max = 64)
     */
    protected $thirdParty;

    /**
     * @var float $debit
     *
     * @ORM\Column(name="debit", type="decimal", scale=2, nullable=true)
     */
    protected $debit;

    /**
     * @var float $credit
     *
     * @ORM\Column(name="credit", type="decimal", scale=2, nullable=true)
     */
    protected $credit;

    /**
     * @var DateTime $valueDate
     *
     * @ORM\Column(name="value_date", type="date", nullable=false)
     * @Assert\NotBlank()
     * @Assert\DateTime()
     */
    protected $valueDate;

    /**
     * @var DateTime $limitDate
     *
     * @ORM\Column(name="limit_date", type="date", nullable=true)
     * @Assert\DateTime()
     */
    protected $limitDate;

    /**
     * @var boolean $isReconciled
     *
     * @ORM\Column(name="is_reconciled", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $isReconciled = false;

    /**
     * @var string $notes
     *
     * @ORM\Column(name="notes", type="text", nullable=true)
     */
    protected $notes;

    /**
     * @var string $frequencyUnit
     *
     * @ORM\Column(name="frequency_unit", type="string", length=16, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"day", "week", "month", "year"})
     */
    protected $frequencyUnit = 'month';

    /**
     * @var integer $frequencyValue
     *
     * @ORM\Column(name="frequency_value", type="smallint", nullable=false)
     * @Assert\NotBlank()
     * @Assert\Type("integer")
     */
    protected $frequencyValue;

    /**
     * @var boolean $isActive
     *
     * @ORM\Column(name="is_active", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $isActive = true;

    /**
     * @var DateTime $createdAt
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     * @Assert\DateTime()
     */
    protected $createdAt;

    /**
     * @var DateTime $updatedAt
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     * @Assert\DateTime()
     */
    protected $updatedAt;

    /**
     * @ORM\PrePersist
     */
    public function prePersist()
    {
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\PreUpdate
     */
    public function preUpdate()
    {
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * Get schedulerId
     *
     * @return integer
     */
    public function getSchedulerId()
    {
        return $this->schedulerId;
    }

    /**
     * Set thirdParty
     *
     * @param string $thirdParty
     */
    public function setThirdParty($thirdParty)
    {
        $this->thirdParty = $thirdParty;
    }

    /**
     * Get thirdParty
     *
     * @return string
     */
    public function getThirdParty()
    {
        return $this->thirdParty;
    }

    /**
     * Set debit
     *
     * @param float $debit
     */
    public function setDebit($debit = null)
    {
        $this->debit = $debit;
    }

    /**
     * Get debit
     *
     * @return float
     */
    public function getDebit()
    {
        return $this->debit;
    }

    /**
     * Set credit
     *
     * @param float $credit
     */
    public function setCredit($credit = null)
    {
        $this->credit = $credit;
    }

    /**
     * Get credit
     *
     * @return float
     */
    public function getCredit()
    {
        return $this->credit;
    }

    /**
     * Get credit or debit
     *
     * @return float
     */
    public function getAmount()
    {
        return (0 != $this->credit) ? $this->credit : -$this->debit;
    }

    /**
     * Set valueDate
     *
     * @param DateTime $valueDate
     */
    public function setValueDate(\DateTime $valueDate = null)
    {
        $this->valueDate = $valueDate;
    }

    /**
     * Get valueDate
     *
     * @return DateTime
     */
    public function getValueDate()
    {
        return $this->valueDate;
    }

    /**
     * Set limitDate
     *
     * @param DateTime $limitDate
     */
    public function setLimitDate(\DateTime $limitDate = null)
    {
        $this->limitDate = $limitDate;
    }

    /**
     * Get limitDate
     *
     * @return DateTime
     */
    public function getLimitDate()
    {
        return $this->limitDate;
    }

    /**
     * Set isReconciled
     *
     * @param boolean $isReconciled
     */
    public function setReconciled($isReconciled)
    {
        $this->isReconciled = (bool) $isReconciled;
    }

    /**
     * Get isReconciled
     *
     * @return boolean
     */
    public function getIsReconciled()
    {
        return $this->isReconciled;
    }

    /**
     * Set notes
     *
     * @param string $notes
     */
    public function setNotes($notes)
    {
        $this->notes = $notes;
    }

    /**
     * Get notes
     *
     * @return string
     */
    public function getNotes()
    {
        return $this->notes;
    }

    /**
     * Set frequencyUnit
     *
     * @param string $frequencyUnit
     */
    public function setFrequencyUnit($frequencyUnit)
    {
        $this->frequencyUnit = $frequencyUnit;
    }

    /**
     * Get frequencyUnit
     *
     * @return string
     */
    public function getFrequencyUnit()
    {
        return $this->frequencyUnit;
    }

    /**
     * Set frequencyValue
     *
     * @param integer $frequencyValue
     */
    public function setFrequencyValue($frequencyValue)
    {
        $this->frequencyValue = (int) $frequencyValue;
    }

    /**
     * Get frequencyValue
     *
     * @return integer
     */
    public function getFrequencyValue()
    {
        return $this->frequencyValue;
    }

    /**
     * Set isActive
     *
     * @param boolean $isActive
     */
    public function setActive($isActive)
    {
        $this->isActive = (bool) $isActive;
    }

    /**
     * Get isActive
     *
     * @return boolean
     */
    public function getIsActive()
    {
        return $this->isActive;
    }

    /**
     * Set createdAt
     *
     * @param DateTime $createdAt
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->createdAt = $createdAt;
    }

    /**
     * Get createdAt
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->createdAt;
    }

    /**
     * Set updatedAt
     *
     * @param DateTime $updatedAt
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * Get updatedAt
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }

    /**
     * Set account
     *
     * @param Krevindiou\BagheeraBundle\Entity\Account $account
     */
    public function setAccount(Account $account)
    {
        $this->account = $account;
    }

    /**
     * Get account
     *
     * @return Krevindiou\BagheeraBundle\Entity\Account
     */
    public function getAccount()
    {
        return $this->account;
    }

    /**
     * Set transferAccount
     *
     * @param Krevindiou\BagheeraBundle\Entity\Account $transferAccount
     */
    public function setTransferAccount(Account $transferAccount = null)
    {
        $this->transferAccount = $transferAccount;
    }

    /**
     * Get transferAccount
     *
     * @return Krevindiou\BagheeraBundle\Entity\Account
     */
    public function getTransferAccount()
    {
        return $this->transferAccount;
    }

    /**
     * Set category
     *
     * @param Krevindiou\BagheeraBundle\Entity\Category $category
     */
    public function setCategory(Category $category = null)
    {
        $this->category = $category;
    }

    /**
     * Get category
     *
     * @return Krevindiou\BagheeraBundle\Entity\Category
     */
    public function getCategory()
    {
        return $this->category;
    }

    /**
     * Set paymentMethod
     *
     * @param Krevindiou\BagheeraBundle\Entity\PaymentMethod $paymentMethod
     */
    public function setPaymentMethod(PaymentMethod $paymentMethod = null)
    {
        $this->paymentMethod = $paymentMethod;
    }

    /**
     * Get paymentMethod
     *
     * @return Krevindiou\BagheeraBundle\Entity\PaymentMethod
     */
    public function getPaymentMethod()
    {
        return $this->paymentMethod;
    }
}
