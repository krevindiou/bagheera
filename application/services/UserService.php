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

use Application\Models\User,
    Application\Forms\UserForm;

/**
 * User service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserService extends CrudService
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

    public function delete(User $user)
    {
        return parent::delete($user);
    }
}
