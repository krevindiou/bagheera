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
 * PaymentMethod entity
 *
 * @category   Application
 * @package    Application_Models
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @Entity
 * @Table(name="payment_method")
 */
class PaymentMethod
{
    /**
     * paymentMethodId attribute
     *
     * @Id @Column(type="integer", name="payment_method_id")
     * @GeneratedValue
     */
    protected $_paymentMethodId;

    /**
     * name attribute
     *
     * @var string
     * @Column(type="string", name="name")
     */
    protected $_name;

    /**
     * type attribute
     *
     * @var string
     * @Column(type="string", name="type")
     */
    protected $_type;

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
     * Names list
     *
     * @var array
     */
    protected $_names = array(
        'credit_card',
        'check',
        'withdrawal',
        'transfer',
        'deposit'
    );

    /**
     * Types list
     *
     * @var array
     */
    protected $_types = array(
        'debit',
        'credit'
    );

    /**
     * Gets paymentMethodId
     *
     * @return integer
     */
    public function getPaymentMethodId()
    {
        return $this->_paymentMethodId;
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
        $this->_name = in_array($name, $this->_names) ? $name : 'credit_card';
    }

    /**
     * Gets type
     *
     * @return string
     */
    public function getType()
    {
        return $this->_type;
    }

    /**
     * Sets type
     *
     * @param  string $type    type to set
     * @return void
     */
    public function setType($type)
    {
        $this->_type = in_array($type, $this->_types) ? $type : $this->_types[0];
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
