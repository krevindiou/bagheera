<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use AppBundle\Entity\Bank;
use AppBundle\Entity\Account;

/**
 * @Route("/manager")
 */
class AccountController extends Controller
{
    /**
     * @Route("/", name="account_home")
     */
    public function homeAction()
    {
        $member = $this->getUser();

        return $this->render(
            'AppBundle:Account:home.html.twig',
            [
                'totalBalances' => $this->get('app.member')->getBalances($member),
                'lastSalary' => $this->get('app.operation')->getLastSalary($member),
                'lastBiggestExpense' => $this->get('app.operation')->getLastBiggestExpense(
                    $member,
                    (new \DateTime())->modify('-1 month')
                ),
                'accountService' => $this->get('app.account'),
                'progress' => $this->get('app.member')->getImportProgress($member),
                'reports' => $this->get('app.report')->getHomepageList($member),
                'tipNewAccount' => $this->get('app.member')->hasNewAccountTip($member),
            ]
        );
    }

    /**
     * @Route("/accounts", name="account_list")
     *
     * @Method("GET")
     */
    public function listAction()
    {
        return $this->render(
            'AppBundle:Account:list.html.twig',
            [
                'banks' => $this->get('app.bank')->getList($this->getUser(), false),
            ]
        );
    }

    /**
     * @Route("/accounts")
     *
     * @Method("POST")
     */
    public function listActionsAction(Request $request)
    {
        $accountsId = (array) $request->request->get('accountsId');
        $banksId = (array) $request->request->get('banksId');

        $member = $this->getUser();

        if ($request->request->has('close')) {
            $this->get('app.account')->close($member, $accountsId);
            $this->get('app.bank')->close($member, $banksId);
            $this->addFlash('success', 'account.close_confirmation');
        } elseif ($request->request->has('delete')) {
            $this->get('app.account')->delete($member, $accountsId);
            $this->get('app.bank')->delete($member, $banksId);
            $this->addFlash('success', 'account.delete_confirmation');
        } elseif ($request->request->has('share')) {
            // @todo
            $this->addFlash('success', 'account.share_confirmation');
        }

        return $this->redirectToRoute('account_list');
    }

    /**
     * @Route("/bank-{bankId}/create-account", requirements={"bankId" = "\d+"}, name="account_create_with_bank")
     * @Route("/create-account", defaults={"bankId" = null}, name="account_create")
     */
    public function createAction(Request $request, Bank $bank = null)
    {
        $member = $this->getUser();

        $accountForm = $this->get('app.account')->getCreateForm($member, $bank);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($this->get('app.account')->saveForm($member, $accountForm)) {
                $this->addFlash('success', 'account.form_confirmation');

                return $this->redirectToRoute(
                    'operation_list',
                    ['accountId' => $accountForm->getData()->getAccountId()]
                );
            }
        }

        return $this->render(
            'AppBundle:Account:form.html.twig',
            [
                'accountForm' => $accountForm->createView(),
            ]
        );
    }

    /**
     * @Route("/account-{accountId}", requirements={"accountId" = "\d+"}, name="account_update")
     */
    public function updateAction(Request $request, Account $account)
    {
        $member = $this->getUser();

        $accountForm = $this->get('app.account')->getUpdateForm($member, $account);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($this->get('app.account')->saveForm($member, $accountForm)) {
                $this->addFlash('success', 'account.form_confirmation');

                return $this->redirectToRoute('account_list');
            }
        }

        return $this->render(
            'AppBundle:Account:form.html.twig',
            [
                'account' => $account,
                'accountForm' => $accountForm->createView(),
            ]
        );
    }

    /**
     * @Route("/import-progress", name="account_import_progress")
     */
    public function importProgressAction()
    {
        $progress = $this->get('app.member')->getImportProgress($this->getUser());

        $data = [];
        foreach ($progress as $v) {
            $data[$v->getAccount()->getAccountId()] = $v->getProgressPct();
        }

        return new JsonResponse($data);
    }
}
