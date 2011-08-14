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

use Application\Services\Transaction as TransactionService;

/**
 * Transaction controller
 *
 * @category   Application
 * @package    Application_Controllers
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class TransactionController extends Zend_Controller_Action
{
    private $_em;
    private $_transactionService;

    public function init()
    {
        $this->_em = Zend_Registry::get('em');
        $this->_transactionService = TransactionService::getInstance();
    }

    public function listAction()
    {
        $accountId = $this->_request->getParam('accountId');
        $page = (int)$this->_request->getParam('page', 1);
        $delete = $this->_request->getPost('delete');
        $reconcile = $this->_request->getPost('reconcile');
        $transactionsId = $this->_request->getPost('transactions');

        if (!empty($transactionsId)) {
            if ($delete) {
                $this->_transactionService->delete($transactionsId);
                $this->_helper->flashMessenger('transactionDeleteOk');
            } elseif ($reconcile) {
                $this->_transactionService->reconcile($transactionsId);
                $this->_helper->flashMessenger('transactionReconcileOk');
            }

            $this->_helper->redirector->gotoRoute(
                array('accountId' => $accountId),
                'transactionsList',
                true
            );
        } else {
            $account = $this->_em->find(
                'Application\\Models\\Account',
                $accountId
            );

            if (null !== $account) {
                $transactions = $this->_transactionService->getTransactions($account, $page);

                $this->view->transactions = $transactions;
                $this->view->accountId = $accountId;
                $this->view->balance = $account->getBalance();
                $this->view->reconciledBalance = $account->getBalance(true);
                $this->view->route = 'transactionsList';
                $this->view->selectedAccount = $account;
            } else {
                $this->_helper->redirector->gotoRoute(array(), 'home', true);
            }
        }
    }

    public function saveAction()
    {
        $accountId = $this->_request->getParam('accountId');
        $transactionId = $this->_request->getParam('transactionId');

        $transaction = null;
        if (null !== $transactionId) {
            $transaction = $this->_em->find('Application\\Models\\Transaction', $transactionId);
        } else {
            $transaction = new Application\Models\Transaction();
        }

        $account = null;
        if (null !== $accountId) {
            $account = $this->_em->find('Application\\Models\\Account', $accountId);

            if (null !== $transaction) {
                $transaction->setAccount($account);
            }
        }

        $transactionForm = $this->_transactionService->getForm($transaction, $this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_transactionService->save($transactionForm)) {
                $this->_helper->flashMessenger('transactionFormOk');
                $this->_helper->redirector->gotoRoute(
                    array('accountId' => $transactionForm->getElement('accountId')->getValue()),
                    'transactionsList',
                    true
                );
            }
        }

        $this->view->transactionForm = $transactionForm;
        $this->view->selectedAccount = (null !== $transaction) ? $transaction->getAccount() : null;
    }
}
