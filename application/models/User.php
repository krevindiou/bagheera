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
 * User entity
 *
 * @category   Application
 * @package    Application_Models
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @Entity
 * @Table(name="user")
 */
class User
{
    /**
     * userId attribute
     *
     * @Id @Column(type="integer", name="user_id")
     * @GeneratedValue
     */
    protected $_userId;

    /**
     * firstname attribute
     *
     * @var string
     * @Column(type="string", name="firstname")
     */
    protected $_firstname;

    /**
     * lastname attribute
     *
     * @var string
     * @Column(type="string", name="lastname")
     */
    protected $_lastname;

    /**
     * email attribute
     *
     * @var string
     * @Column(type="string", name="email")
     */
    protected $_email;

    /**
     * password attribute
     *
     * @var string
     * @Column(type="string", name="password")
     */
    protected $_password;

    /**
     * activation attribute
     *
     * @var string
     * @Column(type="string", name="activation")
     */
    protected $_activation;

    /**
     * isAdmin attribute
     *
     * @var boolean
     * @Column(type="boolean", name="is_admin")
     */
    protected $_isAdmin;

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
     * Banks list
     *
     * @OneToMany(targetEntity="Bank", mappedBy="_user")
     * @OrderBy({"_name" = "ASC"})
     */
    protected $_banks;

    /**
     * Accounts list
     *
     * @ManyToMany(targetEntity="Account")
     * @JoinTable(name="bank",
     *      joinColumns={@JoinColumn(name="user_id", referencedColumnName="user_id")},
     *      inverseJoinColumns={@JoinColumn(name="bank_id", referencedColumnName="bank_id", unique=true)}
     *      )
     * @OrderBy({"_name" = "ASC"})
     */
    protected $_accounts;


    public function __construct()
    {
        $this->setIsAdmin(false);
        $this->setIsActive(false);
        $this->_banks = new \Doctrine\Common\Collections\ArrayCollection();
        $this->_accounts = new \Doctrine\Common\Collections\ArrayCollection();
    }

    /**
     * Gets userId
     *
     * @return integer
     */
    public function getUserId()
    {
        return $this->_userId;
    }

    /**
     * Gets firstname
     *
     * @return string
     */
    public function getFirstname()
    {
        return $this->_firstname;
    }

    /**
     * Sets firstname
     *
     * @param  string $firstname    firstname to set
     * @return void
     */
    public function setFirstname($firstname)
    {
        $this->_firstname = $firstname;
    }

    /**
     * Gets lastname
     *
     * @return string
     */
    public function getLastname()
    {
        return $this->_lastname;
    }

    /**
     * Sets lastname
     *
     * @param  string $lastname    lastname to set
     * @return void
     */
    public function setLastname($lastname)
    {
        $this->_lastname = $lastname;
    }

    /**
     * Gets email
     *
     * @return string
     */
    public function getEmail()
    {
        return $this->_email;
    }

    /**
     * Sets email
     *
     * @param  string $email    email to set
     * @return void
     */
    public function setEmail($email)
    {
        $this->_email = $email;
    }

    /**
     * Gets password
     *
     * @return string
     */
    public function getPassword()
    {
        return $this->_password;
    }

    /**
     * Sets password
     *
     * @param  string $password    password to set
     * @return void
     */
    public function setPassword($password)
    {
        $this->_password = $password;
    }

    /**
     * Gets activation
     *
     * @return string
     */
    public function getActivation()
    {
        return $this->_activation;
    }

    /**
     * Sets activation
     *
     * @param  string $activation    activation to set
     * @return void
     */
    public function setActivation($activation)
    {
        $this->_activation = $activation;
    }

    /**
     * Gets isAdmin
     *
     * @return boolean
     */
    public function getIsAdmin()
    {
        return $this->_isAdmin;
    }

    /**
     * Sets isAdmin
     *
     * @param  boolean $isAdmin    isAdmin to set
     * @return void
     */
    public function setIsAdmin($isAdmin)
    {
        $this->_isAdmin = (bool)$isAdmin;
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

    /**
     * Gets user's banks
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getBanks()
    {
        return $this->_banks;
    }

    /**
     * Gets user's accounts
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getAccounts()
    {
        return $this->_accounts;
    }

    public function getBalance()
    {
        $em = \Zend_Registry::get('em');

        $balance = 0;
        $banks = $this->getBanks();
        foreach ($banks as $bank) {
            $balance+= $bank->getBalance();
        }

        return sprintf('%.2f', $balance);
    }
}
