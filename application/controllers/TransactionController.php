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
 * Bank controller
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
    }

    public function deleteAction()
    {
    }

    public function addAction()
    {
        $params = $this->_request->getPost();

        $transactionForm = $this->_transactionService->getForm(null, $params);

        if ($this->_request->isPost()) {
            if (false !== $this->_transactionService->add($transactionForm)) {
                $redirector = Zend_Controller_Action_HelperBroker::getStaticHelper('redirector');
                $redirector->gotoRoute(array(), 'transactions');
            }
        }

        $this->view->form = $transactionForm;
    }
}
