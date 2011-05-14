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

use Application\Services\Scheduler as SchedulerService;

/**
 * Scheduler controller
 *
 * @category   Application
 * @package    Application_Controllers
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerController extends Zend_Controller_Action
{
    private $_schedulerService;

    public function init()
    {
        $this->_schedulerService = SchedulerService::getInstance();
    }

    public function listAction()
    {
        $em = Zend_Registry::get('em');

        $accountId = $this->_request->getParam('accountId');
        $delete = $this->_request->getPost('delete');
        $schedulers = $this->_request->getPost('schedulers');

        if (!empty($schedulers)) {
            if ($delete) {
                $this->_schedulerService->delete($schedulers);
                $this->_helper->flashMessenger('schedulerDeleteOk');
            }

            $this->_helper->redirector->gotoRoute(
                array('accountId' => $accountId),
                'schedulersList',
                true
            );
        }

        $account = $em->find(
            'Application\\Models\\Account',
            $accountId
        );

        $schedulers = $this->_schedulerService->getSchedulers($account);

        $this->view->schedulers = $schedulers;
        $this->view->accountId = $accountId;
    }

    public function saveAction()
    {
        $schedulerId = $this->_request->getParam('schedulerId');
        $accountId = $this->_request->getParam('accountId');

        $schedulerForm = $this->_schedulerService->getForm(
            ('' != $schedulerId) ? $schedulerId : null,
            array_merge(
                $this->_request->getPost(),
                array('accountId' => $accountId)
            )
        );

        if ($this->_request->isPost()) {
            if ($this->_schedulerService->save($schedulerForm)) {
                $this->_helper->flashMessenger('schedulerFormOk');
                $this->_helper->redirector->gotoRoute(
                    array('accountId' => $schedulerForm->getElement('accountId')->getValue()),
                    'schedulersList',
                    true
                );
            }
        }

        $this->view->schedulerForm = $schedulerForm;
    }
}
