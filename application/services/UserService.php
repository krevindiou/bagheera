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
class UserService extends ServicesAbstract
{
    public function getForm(User $user, array $params = null)
    {
        $userForm = new UserForm;

        foreach ($userForm->getElements() as $element) {
            if (!isset($params[$element->getName()])) {
                $getter = 'get' . ucfirst($element->getName());
                if (is_callable(array($user, $getter))) {
                    $value = $user->$getter();
                    $params[$element->getName()] = $value;
                }
            }
        }

        $userForm->populate($params);

        return $userForm;
    }

    public function add(User $user, UserForm $userForm)
    {
        if ($userForm->isValid($userForm->getValues())) {
            foreach ($userForm->getElements() as $element) {
                $setter = 'set' . ucfirst($element->getName());
                if (is_callable(array($user, $setter))) {
                    $user->$setter($element->getValue());
                }
            }

            $user->setCreatedAt(new \DateTime);
            $user->setUpdatedAt(new \DateTime);

            $this->_em->persist($user);
            $this->_em->flush();
        } else {
            return false;
        }
    }

    public function update(User $user, UserForm $userForm)
    {
        if ($userForm->isValid($userForm->getValues())) {
            foreach ($userForm->getElements() as $element) {
                $setter = 'set' . ucfirst($element->getName());
                if (is_callable(array($user, $setter))) {
                    $user->$setter($element->getValue());
                }
            }

            $user->setUpdatedAt(new \DateTime);

            $this->_em->persist($user);
            $this->_em->flush();
        } else {
            return false;
        }
    }

    public function delete(User $user)
    {}
}
