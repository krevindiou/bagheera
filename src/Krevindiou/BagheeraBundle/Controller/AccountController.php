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
    Symfony\Component\HttpFoundation\Request,
    Symfony\Component\HttpFoundation\Response,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Method,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Entity\Account;

class AccountController extends Controller
{
    /**
     * @Route("/", name="account_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction()
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $banks = $this->get('bagheera.bank')->getList($user, false);
        $progress = $this->get('bagheera.user')->getImportProgress($user);
        $reports = $this->get('bagheera.report')->getHomepageList($user);

        $tipNewAccount = false;
        $hasBankWithoutProvider = $this->get('bagheera.user')->hasBankWithoutProvider($user);
        if ($hasBankWithoutProvider) {
            $accounts = $this->get('bagheera.account')->getList($user);

            if (count($accounts) == 0) {
                $tipNewAccount = true;
            }
        }

        return array(
            'banks' => $banks,
            'accountService' => $this->get('bagheera.account'),
            'totalBalances' => $this->get('bagheera.user')->getBalances($user),
            'progress' => $progress,
            'reports' => $reports,
            'tipNewBank' => (count($banks) == 0),
            'tipNewAccount' => $tipNewAccount
        );
    }

    /**
     * @Route("/")
     * @Method("POST")
     */
    public function listActionsAction(Request $request)
    {
        $accountsId = (array)$request->request->get('accountsId');
        $banksId = (array)$request->request->get('banksId');

        $user = $this->get('security.context')->getToken()->getUser();

        if ($request->request->has('delete')) {
            $this->get('bagheera.account')->delete($user, $accountsId);
            $this->get('bagheera.bank')->delete($user, $banksId);
            $this->get('session')->getFlashBag()->add('success', 'account_delete_confirmation');
        } elseif ($request->request->has('share')) {
            // @todo
            $this->get('session')->getFlashBag()->add('success', 'account_share_confirmation');
        }

        return $this->redirect($this->generateUrl('account_list'));
    }

    /**
     * @Template()
     */
    public function boxAction(Account $account = null)
    {
        if (null !== $account) {
            $user = $this->get('security.context')->getToken()->getUser();
            $accountService = $this->get('bagheera.account');

            $balance = $accountService->getBalance($user, $account);
            $reconciledBalance = $accountService->getBalance($user, $account, true);
        } else {
            $balance = null;
            $reconciledBalance = null;
        }

        return array(
            'account' => $account,
            'balance' => $balance,
            'reconciledBalance' => $reconciledBalance
        );
    }

    /**
     * @Route("/new-account-bank-{bankId}", requirements={"bankId" = "\d+"}, name="account_new")
     * @Template()
     */
    public function newFormAction(Request $request, Bank $bank)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $accountForm = $this->get('bagheera.account')->getNewForm($user, $bank);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $accountForm->bind($request);

            if ($this->get('bagheera.account')->saveForm($user, $accountForm)) {
                $this->get('session')->getFlashBag()->add('success', 'account_form_confirmation');

                return $this->redirect(
                    $this->generateUrl('operation_list', array('accountId' => $accountForm->getData()->getAccountId()))
                );
            }
        }

        return $this->render(
            'KrevindiouBagheeraBundle:Account:form.html.twig',
            array(
                'accountForm' => $accountForm->createView()
            )
        );
    }

    /**
     * @Route("/edit-account-{accountId}", requirements={"accountId" = "\d+"}, name="account_edit")
     * @Template()
     */
    public function editFormAction(Request $request, Account $account)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $accountForm = $this->get('bagheera.account')->getEditForm($user, $account);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $accountForm->bind($request);

            if ($this->get('bagheera.account')->saveForm($user, $accountForm)) {
                $this->get('session')->getFlashBag()->add('success', 'account_form_confirmation');

                return $this->redirect($this->generateUrl('account_list'));
            }
        }

        return $this->render(
            'KrevindiouBagheeraBundle:Account:form.html.twig',
            array(
                'account' => $account,
                'accountForm' => $accountForm->createView()
            )
        );
    }

    /**
     * @Route("/import-progress", name="account_import_progress")
     */
    public function importProgressAction()
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $progress = $this->get('bagheera.user')->getImportProgress($user);

        $data = array();
        foreach ($progress as $v) {
            $data[$v->getAccount()->getAccountId()] = $v->getProgressPct();
        }

        $response = new Response(json_encode(($data)));
        $response->headers->set('Content-Type', 'application/json');

        return $response;
    }
}
