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

namespace Application\Services;

use Application\Models\User as UserModel,
    Application\Forms\User as UserForm;

/**
 * User service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class User extends CrudAbstract
{
    public function getForm($userId, array $params = null)
    {
        $user = $this->_em->find('Application\\Models\\User', $userId);
        return parent::getForm(new UserForm, $user, $params);
    }

    public function add(UserForm $userForm)
    {
        return parent::add($userForm);
    }

    public function update(UserForm $userForm)
    {
        return parent::update($userForm);
    }

    public function delete(UserModel $user)
    {
        return parent::delete($user);
    }

    /**
     * Attempts to connect user
     *
     * @return boolean
     */
    public function login($username, $password)
    {
        $adapter = new \Bagheera_Auth_Adapter_Database($username, $password);
        $auth = \Zend_Auth::getInstance();
        $result = $auth->authenticate($adapter);

        return $result->isValid();
    }

    /**
     * Logs out current user
     *
     * @return void
     */
    public function logout()
    {
        \Zend_Auth::getInstance()->clearIdentity();
    }

    /**
     * Returns true if the user is connected
     *
     * @return boolean
     */
    public function hasIdentity()
    {
        return \Zend_Auth::getInstance()->hasIdentity();
    }

    /**
     * Returns the current user identity
     *
     * @return mixed|null
     */
    public function getIdentity()
    {
        if ($this->hasIdentity()) {
            return \Zend_Auth::getInstance()->getIdentity();
        }
    }
}
