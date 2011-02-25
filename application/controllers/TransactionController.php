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
    private $_transactionService;

    public function init()
    {
        $this->_transactionService = TransactionService::getInstance();
    }

    public function listAction()
    {
        $em = Zend_Registry::get('em');

        $accountId = $this->_request->getParam('accountId');
        $delete = $this->_request->getPost('delete');
        $reconcile = $this->_request->getPost('reconcile');
        $transactions = $this->_request->getPost('transactions');

        if (!empty($transactions)) {
            if ($delete) {
                $this->_transactionService->delete($transactions);
                $this->_helper->flashMessenger('transactionDeleteOk');
            } elseif ($reconcile) {
                $this->_transactionService->reconcile($transactions);
                $this->_helper->flashMessenger('transactionReconcileOk');
            }

            $this->_helper->redirector->gotoRoute(
                array('accountId' => $accountId),
                'transactionsList',
                true
            );
        }

        $account = $em->find(
            'Application\\Models\\Account',
            $accountId
        );

        $transactions = $this->_transactionService->getTransactions($account);
        $this->view->transactions = $transactions;
        $this->view->accountId = $accountId;
        $this->view->balance = $account->getBalance();
    }

    public function saveAction()
    {
        $transactionId = $this->_request->getParam('transactionId');
        $accountId = $this->_request->getParam('accountId');

        $transactionForm = $this->_transactionService->getForm(
            ('' != $transactionId) ? $transactionId : null,
            array_merge(
                $this->_request->getPost(),
                array('accountId' => $accountId)
            )
        );

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
    }
}
