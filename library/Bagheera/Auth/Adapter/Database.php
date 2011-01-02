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

/**
 * Auth database adapter
 *
 * @category   Bagheera
 * @package    Bagheera_Auth
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Bagheera_Auth_Adapter_Database implements Zend_Auth_Adapter_Interface
{
    /**
     * Authentication email
     *
     * @var string
     */
    protected $_email;

    /**
     * Authentication password
     *
     * @var string
     */
    protected $_password;

    /**
     * Sets adapter options
     *
     * @param  string $email
     * @param  string $password
     * @return void
     */
    public function __construct($email, $password)
    {
        $this->setEmail($email);
        $this->setPassword($password);
    }

    /**
     * Returns the email value
     *
     * @return string
     */
    public function getEmail()
    {
        return $this->_email;
    }

    /**
     * Sets the email value
     *
     * @param  string $email
     * @return Bagheera_Auth_Adapter_Database Provides a fluent interface
     */
    public function setEmail($email)
    {
        $this->_email = $email;
        return $this;
    }

    /**
     * Returns the password value
     *
     * @return string
     */
    public function getPassword()
    {
        return $this->_password;
    }

    /**
     * Sets the password value
     *
     * @param  string $password
     * @return Bagheera_Auth_Adapter_Database Provides a fluent interface
     */
    public function setPassword($password)
    {
        $this->_password = $password;
        return $this;
    }

    /**
     * Defined by Zend_Auth_Adapter_Interface
     *
     * @return Zend_Auth_Result
     */
    public function authenticate()
    {
        $authResult = array(
            'code'  => Zend_Auth_Result::FAILURE,
            'identity' => null,
            'messages' => array()
        );

        try {
            $em = Zend_Registry::get('em');

            $dql = 'SELECT u FROM Application\\Models\\User u ';
            $dql.= 'WHERE u._isActive = 1 ';
            $dql.= 'AND u._email = :email ';
            $dql.= 'AND u._password = :password';
            $query = $em->createQuery($dql);
            $query->setParameter('email', $this->getEmail());
            $query->setParameter('password', md5($this->getPassword()));
            $result = $query->getResult();
            if (!empty($result)) {
                $user = $result[0];

                $authResult['code'] = Zend_Auth_Result::SUCCESS;
                $authResult['identity'] = $user->getUserId();
            } else {
                $authResult['code'] = Zend_Auth_Result::FAILURE_CREDENTIAL_INVALID;
                $authResult['messages'][] = 'userInvalidCredential';
            }
        } catch(Exception $e) {
        }

        return new Zend_Auth_Result(
            $authResult['code'],
            $authResult['identity'],
            $authResult['messages']
        );
    }
}
