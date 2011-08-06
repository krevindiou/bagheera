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

use Application\Services\Bank as BankService;

/**
 * Bank controller
 *
 * @category   Application
 * @package    Application_Controllers
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankController extends Zend_Controller_Action
{
    private $_em;
    private $_bankService;

    public function init()
    {
        $this->_em = Zend_Registry::get('em');
        $this->_bankService = BankService::getInstance();
    }

    public function saveAction()
    {
        $bankId = $this->_request->getParam('bankId');

        $bank = null;
        if (null !== $bankId) {
            $bank = $this->_em->find('Application\\Models\\Bank', $bankId);
        }

        $bankForm = $this->_bankService->getForm($bank, $this->_request->getPost());

        if ($this->_request->isPost()) {
            if ($this->_bankService->save($bankForm)) {
                $this->_helper->flashMessenger('bankFormOk');
                $this->_helper->redirector->gotoRoute(array(), 'accountsList', true);
            }
        }

        $this->view->bankForm = $bankForm;
    }
}