<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Bank;
use App\Service\AccountService;
use App\Service\BankService;
use App\Service\MemberService;
use App\Service\OperationService;
use App\Service\ReportService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/manager")
 */
class AccountController extends AbstractController
{
    /**
     * @Route("/", name="account_home")
     */
    public function homeAction(MemberService $memberService, OperationService $operationService, AccountService $accountService, ReportService $reportService)
    {
        $member = $this->getUser();

        return $this->render(
            'Account/home.html.twig',
            [
                'totalBalances' => $memberService->getBalances($member),
                'lastSalary' => $operationService->getLastSalary($member),
                'lastBiggestExpense' => $operationService->getLastBiggestExpense(
                    $member,
                    (new \DateTime())->modify('-1 month')
                ),
                'accountService' => $accountService,
                'progress' => $memberService->getImportProgress($member),
                'reports' => $reportService->getHomepageList($member),
                'tipNewAccount' => $memberService->hasNewAccountTip($member),
            ]
        );
    }

    /**
     * @Route("/accounts", methods={"GET"}, name="account_list")
     */
    public function listAction(BankService $bankService)
    {
        return $this->render(
            'Account/list.html.twig',
            [
                'banks' => $bankService->getList($this->getUser(), false),
            ]
        );
    }

    /**
     * @Route("/accounts", methods={"POST"})
     */
    public function listActionsAction(Request $request, AccountService $accountService, BankService $bankService)
    {
        $accountsId = (array) $request->request->get('accountsId');
        $banksId = (array) $request->request->get('banksId');

        $member = $this->getUser();

        if ($request->request->has('close')) {
            $accountService->close($member, $accountsId);
            $bankService->close($member, $banksId);
            $this->addFlash('success', 'account.close_confirmation');
        } elseif ($request->request->has('delete')) {
            $accountService->delete($member, $accountsId);
            $bankService->delete($member, $banksId);
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
    public function createAction(Request $request, AccountService $accountService, Bank $bank = null)
    {
        $member = $this->getUser();

        $accountForm = $accountService->getCreateForm($member, $bank);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($accountService->saveForm($member, $accountForm)) {
                $this->addFlash('success', 'account.form_confirmation');

                return $this->redirectToRoute(
                    'operation_list',
                    ['accountId' => $accountForm->getData()->getAccountId()]
                );
            }
        }

        return $this->render(
            'Account/form.html.twig',
            [
                'accountForm' => $accountForm->createView(),
            ]
        );
    }

    /**
     * @Route("/account-{accountId}", requirements={"accountId" = "\d+"}, name="account_update")
     */
    public function updateAction(Request $request, AccountService $accountService, Account $account)
    {
        $member = $this->getUser();

        $accountForm = $accountService->getUpdateForm($member, $account);

        if (null === $accountForm) {
            throw $this->createNotFoundException();
        }

        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($accountService->saveForm($member, $accountForm)) {
                $this->addFlash('success', 'account.form_confirmation');

                return $this->redirectToRoute('account_list');
            }
        }

        return $this->render(
            'Account/form.html.twig',
            [
                'account' => $account,
                'accountForm' => $accountForm->createView(),
            ]
        );
    }

    /**
     * @Route("/import-progress", name="account_import_progress")
     */
    public function importProgressAction(MemberService $memberService)
    {
        $progress = $memberService->getImportProgress($this->getUser());

        $data = [];
        foreach ($progress as $v) {
            $data[$v->getAccount()->getAccountId()] = $v->getProgressPct();
        }

        return new JsonResponse($data);
    }
}
