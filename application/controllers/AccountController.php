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
    Application\Services\Bank as BankService,
    Application\Services\Account as AccountService;

/**
 * Account controller
 *
 * @category   Application
 * @package    Application_Controllers
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountController extends Zend_Controller_Action
{
    private $_em;
    private $_userService;
    private $_bankService;
    private $_accountService;

    public function init()
    {
        $this->_em = Zend_Registry::get('em');
        $this->_userService = UserService::getInstance();
        $this->_bankService = BankService::getInstance();
        $this->_accountService = AccountService::getInstance();
    }

    public function summaryAction()
    {
        $delete = $this->_request->getPost('delete');
        $share = $this->_request->getPost('share');
        $accountsId = (array)$this->_request->getPost('accountsId');
        $banksId = (array)$this->_request->getPost('banksId');

        if (!empty($accountsId) || !empty($banksId)) {
            if ($delete) {
                $this->_forward('delete');
            } elseif ($share) {
                $this->_forward('share');
            }
        } else {
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
    }

    public function deleteAction()
    {
        $accountsId = (array)$this->_request->getPost('accountsId');
        $banksId = (array)$this->_request->getPost('banksId');

        foreach ($accountsId as $accountId) {
            $account = $this->_em->find('Application\\Models\\Account', (int)$accountId);

            if (null !== $account) {
                $this->_userService->deleteAccount($account);
            }
        }

        foreach ($banksId as $bankId) {
            $bank = $this->_em->find('Application\\Models\\Bank', (int)$bankId);

            if (null !== $bank) {
                $accounts = $bank->getAccounts();
                foreach ($accounts as $account) {
                    $this->_userService->deleteAccount($account);
                }

                $this->_userService->deleteBank($bank);
            }
        }

        $this->_helper->flashMessenger('accountDeleteMessage');
        $this->_helper->redirector->gotoRoute(array(), 'index', true);
    }

    public function shareAction()
    {
        $em = Zend_Registry::get('em');

        $accountsId = (array)$this->_request->getPost('accountsId');
        $banksId = (array)$this->_request->getPost('banksId');

        // @todo

        $this->_helper->flashMessenger('accountShareMessage');
        $this->_helper->redirector->gotoRoute(array(), 'index', true);
    }

    public function saveAction()
    {
        $accountId = $this->_request->getParam('accountId');

        $account = null;
        if (null !== $accountId) {
            $account = $this->_em->find('Application\\Models\\Account', $accountId);
        }

        $accountForm = $this->_accountService->getForm($account, $this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_accountService->save($accountForm)) {
                $this->_helper->flashMessenger('accountFormOk');
                $this->_helper->redirector->gotoRoute(array(), 'index', true);
            }
        }

        $this->view->accountForm = $accountForm;
        $this->view->accountId = $accountId;
        $this->view->hasAccountDetails = (null !== $account && '' != $account->getDetails());
    }

    public function detailsAction()
    {
        $accountId = $this->_request->getParam('accountId');

        $this->_helper->layout()->disableLayout();
        $this->_helper->viewRenderer->setNoRender(true);

        $account = $this->_em->find('Application\\Models\\Account', $accountId);
        if (null !== $account && '' != $account->getDetails()) {
            $filename = __DIR__ . '/../../data/bankDetails/' . $account->getDetails();
            if (file_exists($filename)) {
                $extension = substr(strrchr($filename, '.'), 1);

                $mimeTypes = array(
                    'pdf' => 'application/pdf',
                    'gif' => 'image/gif',
                    'jpg' => 'image/jpeg',
                    'jpeg' => 'image/jpeg',
                    'png' => 'image/png',
                );

                $mimeType = $mimeTypes[$extension];

                $this->_response->setHeader('Content-Type', $mimeType);
                $this->_response->setHeader(
                    'Content-Disposition',
                    'attachment; filename=accountDetails' . $accountId . '.' . $extension
                );
                $this->_response->setHeader('Content-Length', filesize($filename));
                $this->_response->setBody(file_get_contents($filename));
            }
        }
    }
}
