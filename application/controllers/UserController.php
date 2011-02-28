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
 * User controller
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

    public function loginAction()
    {
        $loginForm = $this->_userService->getLoginForm($this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_userService->login($loginForm)) {
                $this->_helper->redirector->gotoRoute(array(), 'connected', true);
            }
        }

        $this->view->loginForm = $loginForm;
    }

    public function logoutAction()
    {
        $this->_userService->logout();
        $this->_helper->redirector->gotoRoute(array(), 'login', true);
    }

    public function registerAction()
    {
        $registerForm = $this->_userService->getForm(null, $this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_userService->add($registerForm)) {
                $this->_helper->flashMessenger('userRegisterFormConfirmation');
                $this->_helper->redirector->gotoRoute(array(), 'login', true);
            }
        }

        $this->view->registerForm = $registerForm;
    }

    public function forgotPasswordAction()
    {
        $forgotPasswordForm = $this->_userService->getForgotPasswordForm($this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_userService->sendResetPasswordEmail($forgotPasswordForm)) {
                $this->_helper->flashMessenger('userForgotPasswordFormConfirmation');
                $this->_helper->redirector->gotoRoute(array(), 'forgotPassword', true);
            }
        }

        $this->view->forgotPasswordForm = $forgotPasswordForm;
    }

    public function resetPasswordAction()
    {
        $key = $this->_request->getParam('key');

        $resetPasswordForm = $this->_userService->getResetPasswordForm($key, $this->_request->getPost());

        if (null !== $resetPasswordForm) {
            if ($this->_request->isPost()) {
                if ($this->_userService->resetPassword($resetPasswordForm, $key)) {
                    $this->_helper->flashMessenger('userResetPasswordFormConfirmation');
                    $this->_helper->redirector->gotoRoute(array(), 'login', true);
                }
            }
        } else {
            $this->_helper->flashMessenger('userResetPasswordError');
            $this->_helper->redirector->gotoRoute(array(), 'login', true);
        }

        $this->view->resetPasswordForm = $resetPasswordForm;
    }

    public function profileAction()
    {
        $user = $this->_userService->getCurrentUser();

        $profileForm = $this->_userService->getForm($user->getUserId(), $this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_userService->update($profileForm)) {
                $this->_helper->flashMessenger('userEditFormConfirmation');
                $this->_helper->redirector->gotoRoute(array(), 'profile', true);
            }
        }

        $this->view->profileForm = $profileForm;
    }

    public function activateAction()
    {
        $key = $this->_request->getParam('key');

        if ($this->_userService->activate($key)) {
            $this->_helper->flashMessenger('userActivationOk');
        } else {
            $this->_helper->flashMessenger('userActivationNotOk');
        }

        $this->_helper->redirector->gotoRoute(array(), 'login', true);
    }

    public function listAction()
    {
    }

    public function searchAction()
    {
    }

    public function saveAction()
    {
    }
}
