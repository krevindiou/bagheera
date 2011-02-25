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
 * Scheduler entity
 *
 * @category   Application
 * @package    Application_Models
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @Entity
 * @Table(name="scheduler")
 */
class Scheduler
{
    /**
     * schedulerId attribute
     *
     * @Id @Column(type="integer", name="scheduler_id")
     * @GeneratedValue
     */
    protected $_schedulerId;

    /**
     * account attribute
     *
     * @var Application\Models\Account
     * @OneToOne(targetEntity="Account")
     * @JoinColumn(name="account_id", referencedColumnName="account_id")
     */
    protected $_account;

    /**
     * transferAccount attribute
     *
     * @var Application\Models\Account
     * @OneToOne(targetEntity="Account")
     * @JoinColumn(name="transfer_account_id", referencedColumnName="account_id")
     */
    protected $_transferAccount;

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
     * limitDate attribute
     *
     * @var DateTime
     * @Column(type="date", name="limit_date")
     */
    protected $_limitDate;

    /**
     * notes attribute
     *
     * @var string
     * @Column(type="string", name="notes")
     */
    protected $_notes;

    /**
     * frequencyUnit attribute
     *
     * @var string
     * @Column(type="string", name="frequency_unit")
     */
    protected $_frequencyUnit;

    /**
     * frequencyValue attribute
     *
     * @var integer
     * @Column(type="integer", name="frequency_value")
     */
    protected $_frequencyValue;

    /**
     * isActive attribute
     *
     * @var boolean
     * @Column(type="boolean", name="is_active")
     */
    protected $_isActive;

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
     * Frequency values list
     *
     * @var array
     */
    protected $_frequencyValues = array(
        'day','week','month','year'
    );

    /**
     * Gets schedulerId
     *
     * @return integer
     */
    public function getSchedulerId()
    {
        return $this->_schedulerId;
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
     * Gets transferAccount
     *
     * @return Application\Models\Account
     */
    public function getTransferAccount()
    {
        return $this->_transferAccount;
    }

    /**
     * Sets transferAccount
     *
     * @param  Application\Models\Account $transferAccount    transferAccount to set
     * @return void
     */
    public function setTransferAccount(Account $transferAccount = null)
    {
        $this->_transferAccount = $transferAccount;
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
     * Gets limitDate
     *
     * @return DateTime
     */
    public function getLimitDate()
    {
        return $this->_limitDate;
    }

    /**
     * Sets limitDate
     *
     * @param  DateTime $limitDate    limitDate to set
     * @return void
     */
    public function setLimitDate(\DateTime $limitDate)
    {
        $this->_limitDate = $limitDate;
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
     * Gets frequencyUnit
     *
     * @return string
     */
    public function getFrequencyUnit()
    {
        return $this->_frequencyUnit;
    }

    /**
     * Sets frequencyUnit
     *
     * @param  string $frequencyUnit    frequencyUnit to set
     * @return void
     */
    public function setFrequencyUnit($frequencyUnit)
    {
        $this->_frequencyUnit = in_array($frequencyUnit, $this->_frequencyValues) ? $frequencyUnit : 'month';
    }

    /**
     * Gets frequencyValue
     *
     * @return integer
     */
    public function getFrequencyValue()
    {
        return $this->_frequencyValue;
    }

    /**
     * Sets frequencyValue
     *
     * @param  integer $frequencyValue    frequencyValue to set
     * @return void
     */
    public function setFrequencyValue($frequencyValue)
    {
        $this->_frequencyValue = (int)$frequencyValue;
    }

    /**
     * Gets isActive
     *
     * @return boolean
     */
    public function getIsActive()
    {
        return $this->_isActive;
    }

    /**
     * Sets isActive
     *
     * @param  boolean $isActive    isActive to set
     * @return void
     */
    public function setIsActive($isActive)
    {
        $this->_isActive = (bool)$isActive;
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
