<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Service\OperationSearchService;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;

/**
 * @Route("/manager")
 */
class OperationSearchController extends AbstractController
{
    /**
     * @Route("/account-{accountId}/search-operation", requirements={"accountId" = "\d+"}, name="operation_search_form", methods={"GET"})
     */
    public function formAction(Request $request, OperationSearchService $operationSearchService, Account $account, $display = true)
    {
        $operationSearch = $operationSearchService->getSessionSearch($account);

        $operationSearchForm = $operationSearchService->getForm($this->getUser(), $operationSearch, $account);
        if (null === $operationSearchForm) {
            throw $this->createNotFoundException();
        }

        return $this->render(
            'OperationSearch/form.html.twig',
            [
                'account' => $account,
                'operationSearchForm' => $operationSearchForm->createView(),
                'display' => $display,
            ]
        );
    }

    /**
     * @Route("/account-{accountId}/search-operation", requirements={"accountId" = "\d+"}, name="operation_search_submit", methods={"POST"})
     */
    public function submitAction(Request $request, OperationSearchService $operationSearchService, Account $account)
    {
        if (isset($request->request->get('operation_search_form')['clear'])) {
            $operationSearchService->clearSessionSearch($account);
        } else {
            $operationSearch = $operationSearchService->getSessionSearch($account);

            $operationSearchForm = $operationSearchService->getForm($this->getUser(), $operationSearch, $account);
            if (null === $operationSearchForm) {
                throw $this->createNotFoundException();
            }

            $operationSearchForm->handleRequest($request);

            if ($operationSearchForm->isSubmitted()) {
                if ($operationSearchForm->isValid()) {
                    $operationSearchService->setSessionSearch($account, $request->request->get('operation_search_form'));
                }
            }
        }

        return $this->redirectToRoute('operation_list', ['accountId' => $account->getAccountId()]);
    }
}
