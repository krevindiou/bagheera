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
        $accountId = $this->_request->getParam('accountId');

        $em = Zend_Registry::get('em');

        $account = $em->find(
            'Application\\Models\\Account',
            $accountId
        );

        $transactions = $this->_transactionService->getTransactions($account);
        $this->view->transactions = $transactions;
    }

    public function deleteAction()
    {
    }

    public function addAction()
    {
        $transactionForm = $this->_transactionService->getForm(null, $this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_transactionService->add($transactionForm)) {
                $this->_helper->flashMessenger('transactionFormOk');
                $this->_helper->redirector->gotoRoute(array(), 'transactionsList', true);
            }
        }

        $this->view->transactionForm = $transactionForm;
    }
}
