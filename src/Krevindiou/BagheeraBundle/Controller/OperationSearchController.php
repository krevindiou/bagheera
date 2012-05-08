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
        $user = $this->get('security.context')->getToken()->getUser();

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
                $operationSearchForm->bindRequest($request);

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
