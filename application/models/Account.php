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
 * Account entity
 *
 * @category   Application
 * @package    Application_Models
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @Entity
 * @Table(name="account")
 */
class Account
{
    /**
     * accountId attribute
     *
     * @Id @Column(type="integer", name="account_id")
     * @GeneratedValue
     */
    protected $_accountId;

    /**
     * bankId attribute
     *
     * @var integer
     * @Column(type="integer", name="bank_id")
     */
    protected $_bankId;

    /**
     * bank attribute
     *
     * @var Application\Models\Bank
     * @ManyToOne(targetEntity="Bank", inversedBy="_accounts")
     * @JoinColumn(name="bank_id", referencedColumnName="bank_id")
     */
    protected $_bank;

    /**
     * name attribute
     *
     * @var string
     * @Column(type="string", name="name")
     */
    protected $_name;

    /**
     * initialBalance attribute
     *
     * @var float
     * @Column(type="decimal", name="initial_balance")
     */
    protected $_initialBalance;

    /**
     * overdraftFacility attribute
     *
     * @var float
     * @Column(type="decimal", name="overdraft_facility")
     */
    protected $_overdraftFacility;

    /**
     * details attribute
     *
     * @var string
     * @Column(type="string", name="details")
     */
    protected $_details;

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
     * Gets accountId
     *
     * @return integer
     */
    public function getAccountId()
    {
        return $this->_accountId;
    }

    /**
     * Gets bankId
     *
     * @return integer
     */
    public function getBankId()
    {
        return $this->_bankId;
    }

    /**
     * Sets bankId
     *
     * @param  int $bankId    bankId to set
     * @return void
     */
    public function setBankId($bankId)
    {
        $em = \Zend_Registry::get('em');
        $this->_bank = $em->find('Application\\Models\\Bank', $bankId);
        $this->_bankId = $bankId;
    }

    /**
     * Gets bank
     *
     * @return Application\Models\Bank
     */
    public function getBank()
    {
        return $this->_bank;
    }

    /**
     * Sets bank
     *
     * @param  Application\Models\Bank $bank    bank to set
     * @return void
     */
    public function setBank(Bank $bank)
    {
        $this->_bank = $bank;
    }

    /**
     * Gets name
     *
     * @return string
     */
    public function getName()
    {
        return $this->_name;
    }

    /**
     * Sets name
     *
     * @param  string $name    name to set
     * @return void
     */
    public function setName($name)
    {
        $this->_name = $name;
    }

    /**
     * Gets initialBalance
     *
     * @return float
     */
    public function getInitialBalance()
    {
        return sprintf('%.2f', $this->_initialBalance);
    }

    /**
     * Sets initialBalance
     *
     * @param  float $initialBalance    initialBalance to set
     * @return void
     */
    public function setInitialBalance($initialBalance)
    {
        $this->_initialBalance = $initialBalance;
    }

    /**
     * Gets overdraftFacility
     *
     * @return float
     */
    public function getOverdraftFacility()
    {
        return sprintf('%.2f', $this->_overdraftFacility);
    }

    /**
     * Sets overdraftFacility
     *
     * @param  float $overdraftFacility    overdraftFacility to set
     * @return void
     */
    public function setOverdraftFacility($overdraftFacility)
    {
        $this->_overdraftFacility = $overdraftFacility;
    }

    /**
     * Gets details
     *
     * @return string
     */
    public function getDetails()
    {
        return $this->_details;
    }

    /**
     * Sets details
     *
     * @param  string $details    details to set
     * @return void
     */
    public function setDetails($details)
    {
        $this->_details = $details;
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

    public function getBalance($reconciledOnly = false)
    {
        $em = \Zend_Registry::get('em');

        $dql = 'SELECT (SUM(t._credit) - SUM(t._debit)) ';
        $dql.= 'FROM Application\\Models\\Transaction t ';
        $dql.= 'WHERE t._account = :account ';
        if ($reconciledOnly) {
            $dql.= 'AND t._isReconciled = 1 ';
        }

        $query = $em->createQuery($dql);
        $query->setParameter('account', $this);
        $balance = $query->getSingleScalarResult();

        return sprintf('%.2f', $this->getInitialBalance() + $balance);
    }
}
