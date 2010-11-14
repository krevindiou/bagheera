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

use Application\Services\User as UserService,
    Application\Forms\Login as LoginForm;

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
        $loginForm = new LoginForm();

        if ($loginForm->isValid($this->_request->getPost())) {
            $this->_userService->login(
                $this->_request->getPost('email'),
                $this->_request->getPost('password')
            );
        } else {
            $redirector = \Zend_Controller_Action_HelperBroker::getStaticHelper('redirector');
            $redirector->gotoUrl('/?login=error');
        }
    }

    public function logoutAction()
    {
        $this->_userService->logout();
        $this->_redirect('/');
    }

    public function registerAction()
    {
        $params = $this->_request->getPost();

        $form = $this->_userService->getForm(null, $params);

        if ($this->_request->isPost()) {
            if ($this->_userService->add($form)) {
                $this->_helper->flashMessenger->addMessage('userRegisterFormConfirmation');
                $this->_redirect('');
            }
        }

        $this->view->form = $form;
    }

    public function forgotPasswordAction()
    {
        $params = $this->_request->getPost();

        $form = $this->_userService->getForgotPasswordForm();

        if ($this->_request->isPost()) {
            if ($this->_userService->sendResetPasswordEmail($this->_request->getPost('email'))) {
                $this->_helper->flashMessenger->addMessage('userForgotPasswordFormConfirmation');
                $this->_redirect('');
            }
        }

        $this->view->form = $form;
    }

    public function resetPasswordAction()
    {
        $key = $this->_request->getParam('key');

        try {
            $form = $this->_userService->getResetPasswordForm($key, $this->_request->getPost());

            if ($this->_request->isPost()) {
                if ($form->isValid($form->getValues())) {
                    if (false !== $this->_userService->resetPassword($key, $this->_request->getPost('password'))) {
                        $this->_helper->flashMessenger->addMessage('userResetPasswordFormConfirmation');
                        $this->_redirect('');
                    }
                }
            }
        } catch (InvalidArgumentException $e) {
            $form = null;
        }

        $this->view->form = $form;
    }

    public function editAction()
    {
        $params = $this->_request->getPost();

        $identity = $this->_userService->getIdentity();

        $form = $this->_userService->getForm($identity['userId'], $params);

        if ($this->_request->isPost()) {
            if (false !== $this->_userService->update($form)) {
                $redirector = Zend_Controller_Action_HelperBroker::getStaticHelper('redirector');
                $redirector->gotoRoute(array(), 'userEdit');
            }
        }

        $this->view->form = $form;
    }

    public function activateAction()
    {
        $key = $this->_request->getParam('key');

        $messages = array();
        if ($this->_userService->activate($key)) {
            $messages[] = 'userActivationOk';
        } else {
            $messages[] = 'userActivationNotOk';
        }

        $this->view->messages = array_merge($this->view->messages, $messages);
        $this->_forward('index', 'index');
    }
}
