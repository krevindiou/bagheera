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

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;

class AccountController extends Controller
{
    /**
     * @Route("/home", name="account_summary")
     * @Method("GET")
     * @Template()
     */
    public function summaryAction()
    {
        $user = $this->get('security.context')->getToken()->getUser();

        return array(
            'banks' => $user->getBanks(),
            'userService' => $this->get('bagheera.user'),
            'bankService' => $this->get('bagheera.bank'),
            'accountService' => $this->get('bagheera.account'),
        );
    }

    /**
     * @Route("/home")
     * @Method("POST")
     */
    public function summaryActionsAction()
    {
        $request = $this->getRequest();

        $accountsId = (array)$request->request->get('accountsId');
        $banksId = (array)$request->request->get('banksId');

        $user = $this->get('security.context')->getToken()->getUser();

        if ($request->request->get('delete')) {
            $this->get('bagheera.account')->delete($user, $accountsId);
            $this->get('bagheera.bank')->delete($user, $banksId);

            $this->get('session')->setFlash(
                'notice',
                $this->get('translator')->trans('account_delete_confirmation')
            );
        } elseif ($request->request->get('share')) {
            // @todo

            $this->get('session')->setFlash(
                'notice',
                $this->get('translator')->trans('account_share_confirmation')
            );
        }

        return $this->redirect($this->generateUrl('account_summary'));
    }

    /**
     * @Route("/edit-account-{accountId}", requirements={"accountId" = "\d+"}, name="account_edit")
     * @Route("/new-account", name="account_new")
     * @Template()
     */
    public function saveAction($accountId = null)
    {
        return array();
    }

    /**
     * @Route("/account-details-{accountId}", requirements={"accountId" = "\d+"}, name="account_details")
     * @Template()
     */
    public function detailsAction($accountId)
    {
        return array();
    }
}
