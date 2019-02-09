<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use App\Entity\Account;

/**
 * @Route("/manager")
 */
class OperationSearchController extends Controller
{
    /**
     * @Route("/account-{accountId}/search-operation", requirements={"accountId" = "\d+"}, name="operation_search_form", methods={"GET"})
     */
    public function formAction(Request $request, Account $account, $display = true)
    {
        $operationSearchService = $this->get('app.operation_search');

        $operationSearch = $operationSearchService->getSessionSearch($account);

        $operationSearchForm = $operationSearchService->getForm($this->getUser(), $operationSearch, $account);
        if (null === $operationSearchForm) {
            throw $this->createNotFoundException();
        }

        return $this->render(
            'App:OperationSearch:form.html.twig',
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
    public function submitAction(Request $request, Account $account)
    {
        $operationSearchService = $this->get('app.operation_search');

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
