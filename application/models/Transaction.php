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

namespace Application\Models;

/**
 * Transaction entity
 *
 * @category   Application
 * @package    Application_Models
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @Entity
 * @Table(name="transaction")
 */
class Transaction
{
    /**
     * transactionId attribute
     *
     * @Id @Column(type="integer", name="transaction_id")
     * @GeneratedValue
     */
    protected $_transactionId;

    /**
     * scheduler attribute
     *
     * @var Application\Models\Scheduler
     * @OneToOne(targetEntity="Scheduler")
     * @JoinColumn(name="scheduler_id", referencedColumnName="scheduler_id")
     */
    protected $_scheduler;

    /**
     * account attribute
     *
     * @var Application\Models\Account
     * @OneToOne(targetEntity="Account")
     * @JoinColumn(name="account_id", referencedColumnName="account_id")
     */
    protected $_account;

    /**
     * category attribute
     *
     * @var Application\Models\Category
     * @OneToOne(targetEntity="Category")
     * @JoinColumn(name="category_id", referencedColumnName="category_id")
     */
    protected $_category;

    /**
     * thirdParty attribute
     *
     * @var string
     * @Column(type="string", name="third_party")
     */
    protected $_thirdParty;

    /**
     * paymentMethod attribute
     *
     * @var Application\Models\PaymentMethod
     * @OneToOne(targetEntity="PaymentMethod")
     * @JoinColumn(name="payment_method_id", referencedColumnName="payment_method_id")
     */
    protected $_paymentMethod;

    /**
     * debit attribute
     *
     * @var float
     * @Column(type="decimal", name="debit")
     */
    protected $_debit;

    /**
     * credit attribute
     *
     * @var float
     * @Column(type="decimal", name="credit")
     */
    protected $_credit;

    /**
     * valueDate attribute
     *
     * @var DateTime
     * @Column(type="date", name="value_date")
     */
    protected $_valueDate;

    /**
     * isReconciled attribute
     *
     * @var boolean
     * @Column(type="boolean", name="is_reconciled")
     */
    protected $_isReconciled;

    /**
     * notes attribute
     *
     * @var string
     * @Column(type="string", name="notes")
     */
    protected $_notes;

    /**
     * transferTransaction attribute
     *
     * @var Application\Models\Transaction
     * @OneToOne(targetEntity="Transaction", cascade={"all"})
     * @JoinColumn(name="transfer_transaction_id", referencedColumnName="transaction_id")
     */
    protected $_transferTransaction;

    /**
     * createdAt attribute
     *
     * @var DateTime
     * @Column(type="datetime", name="created_at")
     */
    protected $_createdAt;

    /**
     * updatedAt attribute
     *
     * @var DateTime
     * @Column(type="datetime", name="updated_at")
     */
    protected $_updatedAt;


    public function __construct()
    {
        $this->_isReconciled = false;
    }

    /**
     * Gets transactionId
     *
     * @return integer
     */
    public function getTransactionId()
    {
        return $this->_transactionId;
    }

    /**
     * Gets schedulerId
     *
     * @return integer
     */
    public function getSchedulerId()
    {
        return $this->_scheduler->getSchedulerId();
    }

    /**
     * Gets scheduler
     *
     * @return Application\Models\Scheduler
     */
    public function getScheduler()
    {
        return $this->_scheduler;
    }

    /**
     * Sets scheduler
     *
     * @param  Application\Models\Scheduler $scheduler    scheduler to set
     * @return void
     */
    public function setScheduler(Scheduler $scheduler = null)
    {
        $this->_scheduler = $scheduler;
    }

    /**
     * Gets accountId
     *
     * @return integer
     */
    public function getAccountId()
    {
        if (null !== $this->_account) {
            return $this->_account->getAccountId();
        }
    }

    /**
     * Gets account
     *
     * @return Application\Models\Account
     */
    public function getAccount()
    {
        return $this->_account;
    }

    /**
     * Sets account
     *
     * @param  Application\Models\Account $account    account to set
     * @return void
     */
    public function setAccount(Account $account)
    {
        $this->_account = $account;
    }

    /**
     * Gets categoryId
     *
     * @return integer
     */
    public function getCategoryId()
    {
        if (null !== $this->_category) {
            return $this->_category->getCategoryId();
        }
    }

    /**
     * Gets category
     *
     * @return Application\Models\Category
     */
    public function getCategory()
    {
        return $this->_category;
    }

    /**
     * Sets category
     *
     * @param  Application\Models\Category $category    category to set
     * @return void
     */
    public function setCategory(Category $category = null)
    {
        $this->_category = $category;
    }

    /**
     * Gets thirdParty
     *
     * @return string
     */
    public function getThirdParty()
    {
        return $this->_thirdParty;
    }

    /**
     * Sets thirdParty
     *
     * @param  string $thirdParty    thirdParty to set
     * @return void
     */
    public function setThirdParty($thirdParty)
    {
        $this->_thirdParty = $thirdParty;
    }

    /**
     * Gets paymentMethodId
     *
     * @return integer
     */
    public function getPaymentMethodId()
    {
        if (null !== $this->_paymentMethod) {
            return $this->_paymentMethod->getPaymentMethodId();
        }
    }

    /**
     * Gets paymentMethod
     *
     * @return Application\Models\PaymentMethod
     */
    public function getPaymentMethod()
    {
        return $this->_paymentMethod;
    }

    /**
     * Sets paymentMethod
     *
     * @param  Application\Models\PaymentMethod $paymentMethod    paymentMethod to set
     * @return void
     */
    public function setPaymentMethod(PaymentMethod $paymentMethod)
    {
        $this->_paymentMethod = $paymentMethod;
    }

    /**
     * Gets debit
     *
     * @return float
     */
    public function getDebit()
    {
        return sprintf('%.2f', $this->_debit);
    }

    /**
     * Sets debit
     *
     * @param  float $debit    debit to set
     * @return void
     */
    public function setDebit($debit)
    {
        $this->_debit = $debit;
    }

    /**
     * Gets credit
     *
     * @return float
     */
    public function getCredit()
    {
        return sprintf('%.2f', $this->_credit);
    }

    /**
     * Sets credit
     *
     * @param  float $credit    credit to set
     * @return void
     */
    public function setCredit($credit)
    {
        $this->_credit = $credit;
    }

    /**
     * Gets valueDate
     *
     * @return DateTime
     */
    public function getValueDate()
    {
        return $this->_valueDate;
    }

    /**
     * Sets valueDate
     *
     * @param  DateTime $valueDate    valueDate to set
     * @return void
     */
    public function setValueDate(\DateTime $valueDate)
    {
        $this->_valueDate = $valueDate;
    }

    /**
     * Gets isReconciled
     *
     * @return boolean
     */
    public function getIsReconciled()
    {
        return $this->_isReconciled;
    }

    /**
     * Sets isReconciled
     *
     * @param  boolean $isReconciled    isReconciled to set
     * @return void
     */
    public function setIsReconciled($isReconciled)
    {
        $this->_isReconciled = (bool)$isReconciled;
    }

    /**
     * Gets notes
     *
     * @return string
     */
    public function getNotes()
    {
        return $this->_notes;
    }

    /**
     * Sets notes
     *
     * @param  string $notes    notes to set
     * @return void
     */
    public function setNotes($notes)
    {
        $this->_notes = $notes;
    }

    /**
     * Gets transferTransactionId
     *
     * @return integer
     */
    public function getTransferTransactionId()
    {
        if (null !== $this->_transferTransaction) {
            return $this->_transferTransaction->getTransactionId();
        }
    }

    /**
     * Gets transferTransaction
     *
     * @return Application\Models\Transaction
     */
    public function getTransferTransaction()
    {
        return $this->_transferTransaction;
    }

    /**
     * Sets transferTransaction
     *
     * @param  Application\Models\Transaction $transferTransaction    transferTransaction to set
     * @return void
     */
    public function setTransferTransaction(Transaction $transferTransaction = null)
    {
        $this->_transferTransaction = $transferTransaction;
    }

    /**
     * Gets createdAt
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->_createdAt;
    }

    /**
     * Sets createdAt
     *
     * @param  DateTime $createdAt    createdAt to set
     * @return void
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->_createdAt = $createdAt;
    }

    /**
     * Gets updatedAt
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->_updatedAt;
    }

    /**
     * Sets updatedAt
     *
     * @param  DateTime $updatedAt    updatedAt to set
     * @return void
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->_updatedAt = $updatedAt;
    }

    public function __clone()
    {
        $this->_transactionId = null;
    }
}
