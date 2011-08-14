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

class Bagheera_Controller_Plugin_Auth extends Zend_Controller_Plugin_Abstract
{
    /**
     * @see Zend_Controller_Plugin_Abstract::preDispatch
     */
    public function preDispatch(Zend_Controller_Request_Abstract $request)
    {
        $userService = UserService::getInstance();
        $currentUser = $userService->getCurrentUser();
        if (null === $currentUser) {
            $routeName = Zend_Controller_Front::getInstance()->getRouter()->getCurrentRouteName();
            if (!in_array(
                $routeName,
                array(
                    'login',
                    'register',
                    'activate',
                    'forgotPassword',
                    'resetPassword',
                )
            )) {
                $redirector = \Zend_Controller_Action_HelperBroker::getStaticHelper('redirector');
                $redirector->gotoRoute(array(), 'login', true);
            }
        }

        $viewRenderer = Zend_Controller_Action_HelperBroker::getStaticHelper('viewRenderer');
        $viewRenderer->view->currentUser = $currentUser;
    }
}
