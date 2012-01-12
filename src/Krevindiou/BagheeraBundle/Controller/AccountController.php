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

        return array(
            'banks' => $user->getBanks(),
            'userService' => $this->get('bagheera.user'),
            'bankService' => $this->get('bagheera.bank'),
            'accountService' => $this->get('bagheera.account'),
        );
    }

    /**
     * @Route("/home")
     * @Method("POST")
     */
    public function listActionsAction(Request $request)
    {
        $accountsId = (array)$request->request->get('accountsId');
        $banksId = (array)$request->request->get('banksId');

        $user = $this->get('security.context')->getToken()->getUser();

        if ($request->request->get('delete')) {
            $this->get('bagheera.account')->delete($user, $accountsId);
            $this->get('bagheera.bank')->delete($user, $banksId);
            $this->get('session')->setFlash('notice', 'account_delete_confirmation');
        } elseif ($request->request->get('share')) {
            // @todo
            $this->get('session')->setFlash('notice', 'account_share_confirmation');
        }

        return $this->redirect($this->generateUrl('account_list'));
    }

    /**
     * @Template()
     */
    public function boxAction(Account $account = null)
    {
        return array(
            'account' => $account,
            'accountService' => $this->get('bagheera.account')
        );
    }

    /**
     * @Route("/edit-account-{accountId}", requirements={"accountId" = "\d+"}, name="account_edit")
     * @Route("/new-account", defaults={"accountId" = null}, name="account_new")
     * @Template()
     */
    public function formAction(Request $request, Account $account = null)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $accountForm = $this->get('bagheera.account')->getForm($user, $account);
        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $accountForm->bindRequest($request);

            if ($accountForm->isValid()) {
                if ($this->get('bagheera.account')->save($user, $accountForm->getData())) {
                    $this->get('session')->setFlash('notice', 'account_form_confirmation');

                    return $this->redirect($this->generateUrl('account_list'));
                }
            }
        }

        return array(
            'account' => $account,
            'accountForm' => $accountForm->createView()
        );
    }

    /**
     * @Route("/account-details-{accountId}", requirements={"accountId" = "\d+"}, name="account_details")
     */
    public function detailsAction(Account $account)
    {
        $filename = $account->getAbsolutePath();
        if (null !== $filename && file_exists($filename)) {
            $response = new Response(file_get_contents($filename));
            $response->headers->set('Content-Type', mime_content_type($filename));
            $response->headers->set('Content-Disposition', 'attachment; filename=' . $account->getDetails());
            $response->headers->set('Content-Length', filesize($filename));

            return $response;
        }

        throw $this->createNotFoundException();
    }
}
