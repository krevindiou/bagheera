<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Krevindiou\BagheeraBundle\Entity\Transaction
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity()
 * @ORM\Table(name="transaction")
 * @ORM\HasLifecycleCallbacks()
 */
class Transaction
{
    /**
     * @var integer $transactionId
     *
     * @ORM\Column(name="transaction_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    private $transactionId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Transaction $transferTransaction
     *
     * @ORM\OneToOne(targetEntity="Transaction", cascade={"all"})
     * @ORM\JoinColumn(name="transfer_transaction_id", referencedColumnName="transaction_id")
     */
    private $transferTransaction;

    /**
     * @var string $thirdParty
     *
     * @ORM\Column(name="third_party", type="string", length=64, nullable=false)
     */
    private $thirdParty;

    /**
     * @var float $debit
     *
     * @ORM\Column(name="debit", type="decimal", nullable=true)
     */
    private $debit;

    /**
     * @var float $credit
     *
     * @ORM\Column(name="credit", type="decimal", nullable=true)
     */
    private $credit;

    /**
     * @var DateTime $valueDate
     *
     * @ORM\Column(name="value_date", type="date", nullable=false)
     */
    private $valueDate;

    /**
     * @var boolean $isReconciled
     *
     * @ORM\Column(name="is_reconciled", type="boolean", nullable=false)
     */
    private $isReconciled;

    /**
     * @var string $notes
     *
     * @ORM\Column(name="notes", type="text", nullable=false)
     */
    private $notes;

    /**
     * @var DateTime $createdAt
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     */
    private $createdAt;

    /**
     * @var DateTime $updatedAt
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     */
    private $updatedAt;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Account $account
     *
     * @ORM\ManyToOne(targetEntity="Account", inversedBy="transactions")
     * @ORM\JoinColumns({
     *   @ORM\JoinColumn(name="account_id", referencedColumnName="account_id")
     * })
     */
    private $account;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Category $category
     *
     * @ORM\OneToOne(targetEntity="Category")
     * @ORM\JoinColumn(name="category_id", referencedColumnName="category_id")
     */
    private $category;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\PaymentMethod $paymentMethod
     *
     * @ORM\OneToOne(targetEntity="PaymentMethod")
     * @ORM\JoinColumn(name="payment_method_id", referencedColumnName="payment_method_id")
     */
    private $paymentMethod;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Scheduler $scheduler
     *
     * @ORM\OneToOne(targetEntity="Scheduler")
     * @ORM\JoinColumn(name="scheduler_id", referencedColumnName="scheduler_id")
     */
    private $scheduler;


    public function __construct()
    {
        $this->_isReconciled = false;
    }

    /**
     * @ORM\prePersist
     */
    public function prePersist()
    {
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\preUpdate
     */
    public function preUpdate()
    {
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * Get transactionId
     *
     * @return integer
     */
    public function getTransactionId()
    {
        return $this->transactionId;
    }

    /**
     * Set transferTransaction
     *
     * @param Krevindiou\BagheeraBundle\Entity\Transaction $transferTransaction
     */
    public function setTransferTransaction(Transaction $transferTransaction = null)
    {
        $this->transferTransaction = $transferTransaction;
    }

    /**
     * Get transferTransaction
     *
     * @return Krevindiou\BagheeraBundle\Entity\Transaction
     */
    public function getTransferTransaction()
    {
        return $this->transferTransaction;
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
    public function setDebit($debit)
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
    public function setCredit($credit)
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
     * Set valueDate
     *
     * @param DateTime $valueDate
     */
    public function setValueDate(\DateTime $valueDate)
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
     * Set isReconciled
     *
     * @param boolean $isReconciled
     */
    public function setIsReconciled($isReconciled)
    {
        $this->isReconciled = (bool)$isReconciled;
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
    public function setPaymentMethod(PaymentMethod $paymentMethod)
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

    /**
     * Set scheduler
     *
     * @param Krevindiou\BagheeraBundle\Entity\Scheduler $scheduler
     */
    public function setScheduler(Scheduler $scheduler = null)
    {
        $this->scheduler = $scheduler;
    }

    /**
     * Get scheduler
     *
     * @return Krevindiou\BagheeraBundle\Entity\Scheduler
     */
    public function getScheduler()
    {
        return $this->scheduler;
    }

    public function __clone()
    {
        $this->transactionId = null;
    }
}
