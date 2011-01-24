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
use Application\Services\Bank as BankService;
use Application\Services\Account as AccountService;

/**
 * Bank controller
 *
 * @category   Application
 * @package    Application_Controllers
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountController extends Zend_Controller_Action
{
    private $_userService;

    public function init()
    {
        $this->_userService = UserService::getInstance();
        $this->_bankService = BankService::getInstance();
        $this->_accountService = AccountService::getInstance();
    }

    public function summaryAction()
    {
        $user = $this->_userService->getCurrentUser();

        $bankAccounts = array();
        $banks = $user->getBanks();
        foreach ($banks as $bank) {
            $bankAccounts[$bank->getBankId()] = array(
                'bank' => $bank,
                'accounts' => array()
            );
        }
        $accounts = $user->getAccounts();
        foreach ($accounts as $account) {
            $bankAccounts[$account->getBank()->getBankId()]['accounts'][$account->getAccountId()] = $account;
        }

        $this->view->user = $user;
        $this->view->accounts = $bankAccounts;
    }

    public function listAction()
    {
        $user = $this->_userService->getCurrentUser();

        $bankAccounts = array();
        $banks = $user->getBanks();
        foreach ($banks as $bank) {
            $bankAccounts[$bank->getBankId()] = array(
                'bank' => $bank,
                'accounts' => array()
            );
        }
        $accounts = $user->getAccounts();
        foreach ($accounts as $account) {
            $bankAccounts[$account->getBank()->getBankId()]['accounts'][$account->getAccountId()] = $account;
        }

        $this->view->user = $user;
        $this->view->accounts = $bankAccounts;
    }

    public function deleteAction()
    {
        $em = Zend_Registry::get('em');

        $accountsId = (array)$this->_request->getPost('accountsId');
        $banksId = (array)$this->_request->getPost('banksId');

        foreach ($accountsId as $accountId) {
            $account = $em->find('Application\\Models\\Account', (int)$accountId);

            if (null !== $account) {
                $this->_userService->deleteAccount($account);
            }
        }

        foreach ($banksId as $bankId) {
            $bank = $em->find('Application\\Models\\Bank', (int)$bankId);

            if (null !== $bank) {
                $accounts = $bank->getAccounts();
                foreach ($accounts as $account) {
                    $this->_userService->deleteAccount($account);
                }

                $this->_userService->deleteBank($bank);
            }
        }

        $this->_helper->flashMessenger->addMessage('accountDeleteMessage');

        $redirector = Zend_Controller_Action_HelperBroker::getStaticHelper('redirector');
        $redirector->gotoRoute(array(), 'accounts');
    }

    public function shareAction()
    {
        $em = Zend_Registry::get('em');

        $banksId = (array)$this->_request->getPost('banksId');
        $accountsId = (array)$this->_request->getPost('accountsId');

        // ...

        $this->_helper->flashMessenger->addMessage('accountShareMessage');

        $redirector = Zend_Controller_Action_HelperBroker::getStaticHelper('redirector');
        $redirector->gotoRoute(array(), 'accounts');
    }

    public function addAction()
    {
        $params = $this->_request->getPost();

        $accountForm = $this->_accountService->getForm(null, $params);

        if ($this->_request->isPost()) {
            if (false !== $this->_accountService->add($accountForm)) {
                $redirector = Zend_Controller_Action_HelperBroker::getStaticHelper('redirector');
                $redirector->gotoRoute(array(), 'accounts');
            }
        }

        $this->view->form = $accountForm;
    }
}
