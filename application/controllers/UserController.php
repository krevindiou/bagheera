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

use Application\Services\User as UserService;

/**
 * Login controller
 *
 * @category   Application
 * @package    Application_Controllers
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserController extends Zend_Controller_Action
{
    private $_userService;

    public function init()
    {
        $this->_userService = UserService::getInstance();
    }

    public function indexAction()
    {
        $this->view->user = $this->_userService->getIdentity();
    }

    public function createAccountAction()
    {
        $params = $this->_request->getPost();

        $form = $this->_userService->getForm(null, $params);

        if ($this->_request->isPost()) {
            if (false !== $this->_userService->add($form)) {
                $this->_userService->login(
                    $this->_request->getPost('email'),
                    $this->_request->getPost('password')
                );
            }
        }

        $this->view->form = $form;
    }
}
