<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Operation;
use App\Service\AccountService;
use App\Service\OperationSearchService;
use App\Service\OperationService;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route(path: '/manager')]
class OperationController extends AbstractController
{
    #[Route(path: '/account-{accountId}/operations', requirements: ['accountId' => '\d+'], methods: ['GET'], name: 'operation_list')]
    public function list(Request $request, OperationSearchService $operationSearchService, OperationService $operationService, AccountService $accountService, Account $account): Response
    {
        $member = $this->getUser();
        $page = $request->query->getInt('page', 1);
        $operationSearch = $operationSearchService->getSessionSearch($account);
        $operations = $operationService->getList($member, $account, $page, $operationSearch);
        if (null === $operations) {
            throw $this->createNotFoundException();
        }
        $balance = $accountService->getBalance($member, $account);
        $reconciledBalance = $accountService->getBalance($member, $account, true);

        return $this->render(
            'Operation/list.html.twig',
            [
                'account' => $account,
                'operations' => $operations,
                'displaySearch' => (null !== $operationSearch),
                'tipCreateOperation' => (null === $operationSearch && 0 === count($operations)),
                'balance' => $balance,
                'reconciledBalance' => $reconciledBalance,
            ]
        );
    }

    #[Route(path: '/account-{accountId}/operations', requirements: ['accountId' => '\d+'], methods: ['POST'])]
    public function listActions(Request $request, OperationService $operationService, Account $account): Response
    {
        $operationsId = (array) $request->request->get('operationsId');
        $member = $this->getUser();
        if ($request->request->has('delete')) {
            $operationService->delete($member, $operationsId);
            $this->addFlash('success', 'operation.delete_confirmation');
        } elseif ($request->request->has('reconcile')) {
            $operationService->reconcile($member, $operationsId);
            $this->addFlash('success', 'operation.reconcile_confirmation');
        }

        return $this->redirectToRoute('operation_list', ['accountId' => $account->getAccountId()]);
    }

    #[Route(path: '/operation-{operationId}', requirements: ['operationId' => '\d+'], defaults: ['accountId' => null], name: 'operation_update')]
    #[Route(path: '/account-{accountId}/create-operation', requirements: ['accountId' => '\d+'], defaults: ['operationId' => null], name: 'operation_create')]
    #[ParamConverter('operation', class: Operation::class, options: ['id' => 'operationId'])]
    #[ParamConverter('account', class: Account::class, options: ['id' => 'accountId'])]
    public function form(Request $request, OperationService $operationService, ?Account $account, ?Operation $operation): Response
    {
        $member = $this->getUser();
        $operationForm = $operationService->getForm($member, $operation, $account);
        $operationForm->handleRequest($request);
        if ($operationForm->isSubmitted()) {
            if ($operationService->saveForm($member, $operation, $operationForm)) {
                $this->addFlash('success', 'operation.form_confirmation');

                $accountId = $operationForm->getData()->account->getAccountId();

                if (isset($request->request->get('operation_form')['saveCreate'])) {
                    return $this->redirectToRoute('operation_create', ['accountId' => $accountId]);
                }

                return $this->redirectToRoute('operation_list', ['accountId' => $accountId]);
            }
        }

        return $this->render(
            'Operation/form.html.twig',
            [
                'account' => $account ?: $operation->getAccount(),
                'operation' => $operationForm->getData(),
                'operationForm' => $operationForm->createView(),
            ]
        );
    }

    #[Route(path: '/third-parties.json', name: 'operation_third_party_list')]
    public function thirdParty(Request $request, OperationService $operationService): Response
    {
        $thirdParties = $operationService->findThirdParties(
            $this->getUser(),
            $request->query->get('q')
        );

        return new JsonResponse($thirdParties);
    }
}
