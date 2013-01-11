<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller,
    Symfony\Component\HttpFoundation\Request,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template,
    Krevindiou\BagheeraBundle\Entity\OperationSearch,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Form\OperationSearchForm;

class OperationSearchController extends Controller
{
    /**
     * @Route("/search-operation-account-{accountId}", requirements={"accountId" = "\d+"}, name="operation_search_form")
     * @Template()
     */
    public function formAction(Request $request, Account $account, $display = true)
    {
        $user = $this->getUser();

        $operationSearchService = $this->get('bagheera.operation_search');

        $operationSearch = $operationSearchService->getSessionSearch($account);

        $operationSearchForm = $operationSearchService->getForm($user, $operationSearch, $account);
        if (null === $operationSearchForm) {
            throw $this->createNotFoundException();
        }

        if ('' != $request->request->get('clear')) {
            $operationSearchService->clearSessionSearch($account);

            return $this->redirect(
                $this->generateUrl('operation_list', array('accountId' => $account->getAccountId()))
            );
        } else {
            if ($request->getMethod() == 'POST') {
                $operationSearchForm->bind($request);

                if ($operationSearchForm->isValid()) {
                    $operationSearchService->setSessionSearch(
                        $account,
                        $request->request->get('krevindiou_bagheerabundle_operationsearchtype')
                    );

                    return $this->redirect(
                        $this->generateUrl('operation_list', array('accountId' => $account->getAccountId()))
                    );
                }
            }
        }

        return array(
            'account' => $account,
            'operationSearchForm' => $operationSearchForm->createView(),
            'display' => $display
        );
    }
}
