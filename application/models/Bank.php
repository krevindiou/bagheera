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

use Application\Models\Bank;

/**
 * Bank entity
 *
 * @category   Application
 * @package    Application_Models
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @Entity
 * @Table(name="bank")
 */
class Bank
{
    /**
     * bankId attribute
     *
     * @Id @Column(type="integer", name="bank_id")
     * @GeneratedValue
     */
    protected $_bankId;

    /**
     * user attribute
     *
     * @var Application\Models\User
     * @OneToOne(targetEntity="User")
     * @JoinColumn(name="user_id", referencedColumnName="user_id")
     */
    protected $_user;

    /**
     * name attribute
     *
     * @var string
     * @Column(type="string", name="name")
     */
    protected $_name;

    /**
     * info attribute
     *
     * @var string
     * @Column(type="string", name="info")
     */
    protected $_info;

    /**
     * contact attribute
     *
     * @var string
     * @Column(type="string", name="contact")
     */
    protected $_contact;

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
     * @param  integer $bankId    bankId to set
     * @return void
     */
    public function setBankId($bankId)
    {
        $this->_bankId = (int)$bankId;
    }

    /**
     * Gets user
     *
     * @return Application\Models\User
     */
    public function getUser()
    {
        return $this->_user;
    }

    /**
     * Sets user
     *
     * @param  Application\Models\User $user    user to set
     * @return void
     */
    public function setUser(User $user)
    {
        $this->_user = $user;
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
     * Gets info
     *
     * @return string
     */
    public function getInfo()
    {
        return $this->_info;
    }

    /**
     * Sets info
     *
     * @param  string $info    info to set
     * @return void
     */
    public function setInfo($info)
    {
        $this->_info = $info;
    }

    /**
     * Gets contact
     *
     * @return string
     */
    public function getContact()
    {
        return $this->_contact;
    }

    /**
     * Sets contact
     *
     * @param  string $contact    contact to set
     * @return void
     */
    public function setContact($contact)
    {
        $this->_contact = $contact;
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
