<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use AppBundle\Entity\Operation;
use AppBundle\Entity\Account;

/**
 * @Route("/manager")
 */
class OperationController extends Controller
{
    /**
     * @Route("/account-{accountId}/operations", requirements={"accountId" = "\d+"}, name="operation_list")
     *
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request, Account $account)
    {
        $member = $this->getUser();

        $page = $request->query->getInt('page', 1);

        $operationSearch = $this->get('app.operation_search')->getSessionSearch($account);
        $operations = $this->get('app.operation')->getList($member, $account, $page, $operationSearch);
        if (null === $operations) {
            throw $this->createNotFoundException();
        }

        $accountService = $this->get('app.account');

        $balance = $accountService->getBalance($member, $account);
        $reconciledBalance = $accountService->getBalance($member, $account, true);

        return [
            'account' => $account,
            'operations' => $operations,
            'displaySearch' => (null !== $operationSearch),
            'tipCreateOperation' => (null === $operationSearch && count($operations) == 0),
            'balance' => $balance,
            'reconciledBalance' => $reconciledBalance,
        ];
    }

    /**
     * @Route("/account-{accountId}/operations", requirements={"accountId" = "\d+"})
     *
     * @Method("POST")
     */
    public function listActionsAction(Request $request, Account $account)
    {
        $operationsId = (array) $request->request->get('operationsId');

        $member = $this->getUser();

        if ($request->request->has('delete')) {
            $this->get('app.operation')->delete($member, $operationsId);
            $this->get('session')->getFlashBag()->add('success', 'operation.delete_confirmation');
        } elseif ($request->request->has('reconcile')) {
            $this->get('app.operation')->reconcile($member, $operationsId);
            $this->get('session')->getFlashBag()->add('success', 'operation.reconcile_confirmation');
        }

        return $this->redirect(
            $this->generateUrl('operation_list', ['accountId' => $account->getAccountId()])
        );
    }

    /**
     * @Route("/operation-{operationId}", requirements={"operationId" = "\d+"}, defaults={"accountId" = null}, name="operation_update")
     * @Route("/account-{accountId}/create-operation", requirements={"accountId" = "\d+"}, defaults={"operationId" = null}, name="operation_create")
     * @ParamConverter("operation", class="Model:Operation", options={"id" = "operationId"})
     * @ParamConverter("account", class="Model:Account", options={"id" = "accountId"})
     * @Template()
     */
    public function formAction(Request $request, Account $account = null, Operation $operation = null)
    {
        $member = $this->getUser();

        $operationForm = $this->get('app.operation')->getForm($member, $operation, $account);
        if (null === $operationForm) {
            throw $this->createNotFoundException();
        }

        $operationForm->handleRequest($request);

        if ($operationForm->isSubmitted()) {
            if ($this->get('app.operation')->saveForm($member, $operationForm)) {
                $this->get('session')->getFlashBag()->add('success', 'operation.form_confirmation');

                $accountId = $operationForm->getData()->getAccount()->getAccountId();

                if (isset($request->request->get('operation')['saveCreate'])) {
                    return $this->redirect($this->generateUrl('operation_create', ['accountId' => $accountId]));
                } else {
                    return $this->redirect($this->generateUrl('operation_list', ['accountId' => $accountId]));
                }
            }
        }

        return [
            'account' => $account ?: $operation->getAccount(),
            'operation' => $operationForm->getData(),
            'operationForm' => $operationForm->createView(),
        ];
    }

    /**
     * @Route("/third-parties.json", name="operation_third_party_list")
     */
    public function thirdPartyAction(Request $request)
    {
        $thirdParties = $this->get('app.operation')->findThirdParties(
            $this->getUser(),
            $request->query->get('q')
        );

        return new JsonResponse($thirdParties);
    }
}
