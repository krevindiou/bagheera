<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Service\OperationSearchService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route(path: '/manager')]
class OperationSearchController extends AbstractController
{
    #[Route(path: '/account-{accountId}/search-operation', requirements: ['accountId' => '\d+'], name: 'operation_search_form', methods: ['GET'])]
    public function form(OperationSearchService $operationSearchService, Account $account, $display = true): Response
    {
        $formModel = $operationSearchService->getSessionSearch($account);
        $operationSearchForm = $operationSearchService->getForm($this->getUser(), $formModel, $account);

        return $this->render(
            'OperationSearch/form.html.twig',
            [
                'account' => $account,
                'operationSearchForm' => $operationSearchForm->createView(),
                'display' => $display,
            ]
        );
    }

    #[Route(path: '/account-{accountId}/search-operation', requirements: ['accountId' => '\d+'], name: 'operation_search_submit', methods: ['POST'])]
    public function submit(Request $request, OperationSearchService $operationSearchService, Account $account): Response
    {
        if (isset($request->request->get('operation_search_form')['clear'])) {
            $operationSearchService->clearSessionSearch($account);
        } else {
            $formModel = $operationSearchService->getSessionSearch($account);

            $operationSearchForm = $operationSearchService->getForm($this->getUser(), $formModel, $account);
            $operationSearchForm->handleRequest($request);

            if ($operationSearchForm->isSubmitted()) {
                if ($operationSearchForm->isValid()) {
                    $operationSearchService->setSessionSearch($account, $operationSearchForm->getData());
                }
            }
        }

        return $this->redirectToRoute('operation_list', ['accountId' => $account->getAccountId()]);
    }
}
