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
    Krevindiou\BagheeraBundle\Entity\Operation,
    Krevindiou\BagheeraBundle\Entity\Account;

class OperationController extends Controller
{
    /**
     * @Route("/operations-account-{accountId}", requirements={"accountId" = "\d+"}, name="operation_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request, Account $account)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $page = $request->query->getInt('page', 1);

        $operationSearch = $this->get('bagheera.operation_search')->getSessionSearch($account);
        $operations = $this->get('bagheera.operation')->getList($user, $account, $page, $operationSearch);
        if (null === $operations) {
            throw $this->createNotFoundException();
        }

        return array(
            'account' => $account,
            'operations' => $operations,
            'displaySearch' => (null !== $operationSearch),
            'tipNewOperation' => (null === $operationSearch && count($operations) == 0)
        );
    }

    /**
     * @Route("/operations-account-{accountId}", requirements={"accountId" = "\d+"})
     * @Method("POST")
     */
    public function listActionsAction(Request $request, Account $account)
    {
        $operationsId = (array)$request->request->get('operationsId');

        $user = $this->get('security.context')->getToken()->getUser();

        if ($request->request->get('delete')) {
            $this->get('bagheera.operation')->delete($user, $operationsId);
            $this->get('session')->setFlash('notice', 'operation_delete_confirmation');
        } elseif ($request->request->get('reconcile')) {
            $this->get('bagheera.operation')->reconcile($user, $operationsId);
            $this->get('session')->setFlash('notice', 'operation_reconcile_confirmation');
        }

        return $this->redirect(
            $this->generateUrl('operation_list', array('accountId' => $account->getAccountId()))
        );
    }

    /**
     * @Route("/edit-operation-{operationId}", requirements={"operationId" = "\d+"}, defaults={"accountId" = null}, name="operation_edit")
     * @Route("/new-operation-account-{accountId}", requirements={"accountId" = "\d+"}, defaults={"operationId" = null}, name="operation_new")
     * @Template()
     */
    public function formAction(Request $request, Account $account = null, Operation $operation = null)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $operationForm = $this->get('bagheera.operation')->getForm($user, $operation, $account);
        if (null === $operationForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $operationForm->bindRequest($request);

            if ($this->get('bagheera.operation')->saveForm($user, $operationForm)) {
                $this->get('session')->setFlash('notice', 'operation_form_confirmation');

                return $this->redirect(
                    $this->generateUrl('operation_list', array('accountId' => $operationForm->getData()->getAccount()->getAccountId()))
                );
            }
        }

        return array(
            'account' => $account ? : $operation->getAccount(),
            'operation' => $operationForm->getData(),
            'operationForm' => $operationForm->createView()
        );
    }

    /**
     * @Route("/third-parties.json", name="operation_third_party_list")
     */
    public function thirdPartyAction(Request $request)
    {
        $thirdParties = $this->get('bagheera.operation')->findThirdParties(
            $this->get('security.context')->getToken()->getUser(),
            $request->query->get('q')
        );

        $response = new Response(json_encode($thirdParties));
        $response->headers->set('Content-Type', 'application/json');
        return $response;
    }
}
