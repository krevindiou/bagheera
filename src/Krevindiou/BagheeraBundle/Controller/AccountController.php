<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Krevindiou\BagheeraBundle\Entity\Bank;
use Krevindiou\BagheeraBundle\Entity\Account;

class AccountController extends Controller
{
    /**
     * @Route("/", name="account_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction()
    {
        $user = $this->getUser();

        $banks = $this->get('bagheera.bank')->getList($user, false);
        $progress = $this->get('bagheera.user')->getImportProgress($user);
        $reports = $this->get('bagheera.report')->getHomepageList($user);

        $tipNewAccount = false;
        $hasBankWithoutProvider = $this->get('bagheera.user')->hasBankWithoutProvider($user);
        if ($hasBankWithoutProvider) {
            $accounts = $this->get('bagheera.account')->getList($user);

            if (count($accounts) == 0) {
                $tipNewAccount = true;
            }
        }

        return array(
            'banks' => $banks,
            'accountService' => $this->get('bagheera.account'),
            'totalBalances' => $this->get('bagheera.user')->getBalances($user),
            'progress' => $progress,
            'reports' => $reports,
            'tipNewBank' => (count($banks) == 0),
            'tipNewAccount' => $tipNewAccount
        );
    }

    /**
     * @Route("/")
     * @Method("POST")
     */
    public function listActionsAction(Request $request)
    {
        $accountsId = (array) $request->request->get('accountsId');
        $banksId = (array) $request->request->get('banksId');

        $user = $this->getUser();

        if ($request->request->has('delete')) {
            $this->get('bagheera.account')->delete($user, $accountsId);
            $this->get('bagheera.bank')->delete($user, $banksId);
            $this->get('session')->getFlashBag()->add('success', 'account_delete_confirmation');
        } elseif ($request->request->has('share')) {
            // @todo
            $this->get('session')->getFlashBag()->add('success', 'account_share_confirmation');
        }

        return $this->redirect($this->generateUrl('account_list'));
    }

    /**
     * @Route("/new-account-bank-{bankId}", requirements={"bankId" = "\d+"}, name="account_new")
     * @Template()
     */
    public function newFormAction(Request $request, Bank $bank)
    {
        $user = $this->getUser();

        $accountForm = $this->get('bagheera.account')->getNewForm($user, $bank);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $accountForm->bind($request);

            if ($this->get('bagheera.account')->saveForm($user, $accountForm)) {
                $this->get('session')->getFlashBag()->add('success', 'account_form_confirmation');

                return $this->redirect(
                    $this->generateUrl('operation_list', array('accountId' => $accountForm->getData()->getAccountId()))
                );
            }
        }

        return $this->render(
            'KrevindiouBagheeraBundle:Account:form.html.twig',
            array(
                'accountForm' => $accountForm->createView()
            )
        );
    }

    /**
     * @Route("/edit-account-{accountId}", requirements={"accountId" = "\d+"}, name="account_edit")
     * @Template()
     */
    public function editFormAction(Request $request, Account $account)
    {
        $user = $this->getUser();

        $accountForm = $this->get('bagheera.account')->getEditForm($user, $account);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $accountForm->bind($request);

            if ($this->get('bagheera.account')->saveForm($user, $accountForm)) {
                $this->get('session')->getFlashBag()->add('success', 'account_form_confirmation');

                return $this->redirect($this->generateUrl('account_list'));
            }
        }

        return $this->render(
            'KrevindiouBagheeraBundle:Account:form.html.twig',
            array(
                'account' => $account,
                'accountForm' => $accountForm->createView()
            )
        );
    }

    /**
     * @Route("/import-progress", name="account_import_progress")
     */
    public function importProgressAction()
    {
        $user = $this->getUser();

        $progress = $this->get('bagheera.user')->getImportProgress($user);

        $data = array();
        foreach ($progress as $v) {
            $data[$v->getAccount()->getAccountId()] = $v->getProgressPct();
        }

        $response = new Response(json_encode(($data)));
        $response->headers->set('Content-Type', 'application/json');

        return $response;
    }
}
