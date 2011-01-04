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
     * accountId attribute
     *
     * @var integer
     * @Column(type="integer", name="account_id")
     */
    protected $_accountId;

    /**
     * account attribute
     *
     * @var Application\Models\Account
     * @OneToOne(targetEntity="Account")
     * @JoinColumn(name="account_id", referencedColumnName="account_id")
     */
    protected $_account;

    /**
     * categoryId attribute
     *
     * @var integer
     * @Column(type="integer", name="category_id")
     */
    protected $_categoryId;

    /**
     * category attribute
     *
     * @var Application\Models\Category
     * @OneToOne(targetEntity="Category")
     * @JoinColumn(name="category_id", referencedColumnName="category_id")
     */
    protected $_category;

    /**
     * thirdPartyId attribute
     *
     * @var integer
     * @Column(type="integer", name="third_party_id")
     */
    protected $_thirdPartyId;

    /**
     * thirdParty attribute
     *
     * @var Application\Models\ThirdParty
     * @OneToOne(targetEntity="ThirdParty")
     * @JoinColumn(name="third_party_id", referencedColumnName="third_party_id")
     */
    protected $_thirdParty;

    /**
     * paymentMethodId attribute
     *
     * @var integer
     * @Column(type="integer", name="payment_method_id")
     */
    protected $_paymentMethodId;

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
     * @Column(type="datetime", name="value_date")
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
     * transferAccountId attribute
     *
     * @var integer
     * @Column(type="integer", name="transfer_account_id")
     */
    protected $_transferAccountId;

    /**
     * transferAccount attribute
     *
     * @var Application\Models\Account
     * @OneToOne(targetEntity="Account")
     * @JoinColumn(name="transfer_account_id", referencedColumnName="transfer_account_id")
     */
    protected $_transferAccount;

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
    public function setScheduler(Scheduler $scheduler)
    {
        $this->_scheduler = $scheduler;
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
    public function setCategory(Category $category)
    {
        $this->_category = $category;
    }

    /**
     * Gets thirdParty
     *
     * @return Application\Models\ThirdParty
     */
    public function getThirdParty()
    {
        return $this->_thirdParty;
    }

    /**
     * Sets thirdParty
     *
     * @param  Application\Models\ThirdParty $thirdParty    thirdParty to set
     * @return void
     */
    public function setThirdParty(ThirdParty $thirdParty)
    {
        $this->_thirdParty = $thirdParty;
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
        return $this->_debit;
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
        return $this->_credit;
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
     * Gets transferAccount
     *
     * @return Application\Models\Account
     */
    public function getTransferAccount()
    {
        return $this->_transferAccount;
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
}
