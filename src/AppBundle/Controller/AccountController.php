<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
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
     * @Template()
     */
    public function homeAction()
    {
        $member = $this->getUser();

        return [
            'totalBalances' => $this->get('bagheera.member')->getBalances($member),
            'lastSalary' => $this->get('bagheera.operation')->getLastSalary($member),
            'lastBiggestExpense' => $this->get('bagheera.operation')->getLastBiggestExpense(
                $member,
                (new \DateTime())->modify('-1 month')
            ),
            'accountService' => $this->get('bagheera.account'),
            'progress' => $this->get('bagheera.member')->getImportProgress($member),
            'reports' => $this->get('bagheera.report')->getHomepageList($member),
            'tipNewAccount' => $this->get('bagheera.member')->hasNewAccountTip($member)
        ];
    }

    /**
     * @Route("/accounts", name="account_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction()
    {
        return [
            'banks' => $this->get('bagheera.bank')->getList($this->getUser(), false)
        ];
    }

    /**
     * @Route("/accounts")
     * @Method("POST")
     */
    public function listActionsAction(Request $request)
    {
        $accountsId = (array) $request->request->get('accountsId');
        $banksId = (array) $request->request->get('banksId');

        $member = $this->getUser();

        if ($request->request->has('close')) {
            $this->get('bagheera.account')->close($member, $accountsId);
            $this->get('bagheera.bank')->close($member, $banksId);
            $this->get('session')->getFlashBag()->add('success', 'account.close_confirmation');
        } elseif ($request->request->has('delete')) {
            $this->get('bagheera.account')->delete($member, $accountsId);
            $this->get('bagheera.bank')->delete($member, $banksId);
            $this->get('session')->getFlashBag()->add('success', 'account.delete_confirmation');
        } elseif ($request->request->has('share')) {
            // @todo
            $this->get('session')->getFlashBag()->add('success', 'account.share_confirmation');
        }

        return $this->redirect($this->generateUrl('account_list'));
    }

    /**
     * @Route("/bank-{bankId}/new-account", requirements={"bankId" = "\d+"}, name="account_new_with_bank")
     * @Route("/new-account", defaults={"bankId" = null}, name="account_new")
     * @Template()
     */
    public function newFormAction(Request $request, Bank $bank = null)
    {
        $member = $this->getUser();

        $accountForm = $this->get('bagheera.account')->getNewForm($member, $bank);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($this->get('bagheera.account')->saveForm($member, $accountForm)) {
                $this->get('session')->getFlashBag()->add('success', 'account.form_confirmation');

                return $this->redirect(
                    $this->generateUrl('operation_list', ['accountId' => $accountForm->getData()->getAccountId()])
                );
            }
        }

        return $this->render(
            'AppBundle:Account:form.html.twig',
            [
                'accountForm' => $accountForm->createView()
            ]
        );
    }

    /**
     * @Route("/account-{accountId}", requirements={"accountId" = "\d+"}, name="account_edit")
     * @Template()
     */
    public function editFormAction(Request $request, Account $account)
    {
        $member = $this->getUser();

        $accountForm = $this->get('bagheera.account')->getEditForm($member, $account);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($this->get('bagheera.account')->saveForm($member, $accountForm)) {
                $this->get('session')->getFlashBag()->add('success', 'account.form_confirmation');

                return $this->redirect($this->generateUrl('account_list'));
            }
        }

        return $this->render(
            'AppBundle:Account:form.html.twig',
            [
                'account' => $account,
                'accountForm' => $accountForm->createView()
            ]
        );
    }

    /**
     * @Route("/import-progress", name="account_import_progress")
     */
    public function importProgressAction()
    {
        $progress = $this->get('bagheera.member')->getImportProgress($this->getUser());

        $data = [];
        foreach ($progress as $v) {
            $data[$v->getAccount()->getAccountId()] = $v->getProgressPct();
        }

        return new JsonResponse($data);
    }
}
