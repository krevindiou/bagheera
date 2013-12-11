<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Krevindiou\BagheeraBundle\Entity\Operation;
use Krevindiou\BagheeraBundle\Entity\Account;

/**
 * @Route("/manager")
 */
class OperationController extends Controller
{
    /**
     * @Route("/account-{accountId}/operations", requirements={"accountId" = "\d+"}, name="operation_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request, Account $account)
    {
        $member = $this->getUser();

        $page = $request->query->getInt('page', 1);

        $operationSearch = $this->get('bagheera.operation_search')->getSessionSearch($account);
        $operations = $this->get('bagheera.operation')->getList($member, $account, $page, $operationSearch);
        if (null === $operations) {
            throw $this->createNotFoundException();
        }

        $accountService = $this->get('bagheera.account');

        $balance = $accountService->getBalance($member, $account);
        $reconciledBalance = $accountService->getBalance($member, $account, true);

        return [
            'account' => $account,
            'operations' => $operations,
            'displaySearch' => (null !== $operationSearch),
            'tipNewOperation' => (null === $operationSearch && count($operations) == 0),
            'balance' => $balance,
            'reconciledBalance' => $reconciledBalance
        ];
    }

    /**
     * @Route("/account-{accountId}/operations", requirements={"accountId" = "\d+"})
     * @Method("POST")
     */
    public function listActionsAction(Request $request, Account $account)
    {
        $operationsId = (array) $request->request->get('operationsId');

        $member = $this->getUser();

        if ($request->request->has('delete')) {
            $this->get('bagheera.operation')->delete($member, $operationsId);
            $this->get('session')->getFlashBag()->add('success', 'operation.delete_confirmation');
        } elseif ($request->request->has('reconcile')) {
            $this->get('bagheera.operation')->reconcile($member, $operationsId);
            $this->get('session')->getFlashBag()->add('success', 'operation.reconcile_confirmation');
        }

        return $this->redirect(
            $this->generateUrl('operation_list', ['accountId' => $account->getAccountId()])
        );
    }

    /**
     * @Route("/operation-{operationId}", requirements={"operationId" = "\d+"}, defaults={"accountId" = null}, name="operation_edit")
     * @Route("/account-{accountId}/new-operation", requirements={"accountId" = "\d+"}, defaults={"operationId" = null}, name="operation_new")
     * @ParamConverter("operation", class="KrevindiouBagheeraBundle:Operation", options={"id" = "operationId"})
     * @ParamConverter("account", class="KrevindiouBagheeraBundle:Account", options={"id" = "accountId"})
     * @Template()
     */
    public function formAction(Request $request, Account $account = null, Operation $operation = null)
    {
        $member = $this->getUser();

        $operationForm = $this->get('bagheera.operation')->getForm($member, $operation, $account);
        if (null === $operationForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $operationForm->bind($request);

            if ($this->get('bagheera.operation')->saveForm($member, $operationForm)) {
                $this->get('session')->getFlashBag()->add('success', 'operation.form_confirmation');

                $accountId = $operationForm->getData()->getAccount()->getAccountId();

                if (null !== $request->get('save_add')) {
                    return $this->redirect($this->generateUrl('operation_new', ['accountId' => $accountId]));
                } else {
                    return $this->redirect($this->generateUrl('operation_list', ['accountId' => $accountId]));
                }
            }
        }

        return [
            'account' => $account ? : $operation->getAccount(),
            'operation' => $operationForm->getData(),
            'operationForm' => $operationForm->createView()
        ];
    }

    /**
     * @Route("/third-parties.json", name="operation_third_party_list")
     */
    public function thirdPartyAction(Request $request)
    {
        $thirdParties = $this->get('bagheera.operation')->findThirdParties(
            $this->getUser(),
            $request->query->get('q')
        );

        return new JsonResponse($thirdParties);
    }
}
