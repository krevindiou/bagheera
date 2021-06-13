<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Bank;
use App\Repository\BankRepository;
use App\Service\AccountService;
use App\Service\BankService;
use App\Service\MemberService;
use App\Service\OperationService;
use App\Service\ReportService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/manager")
 */
class AccountController extends AbstractController
{
    /**
     * @Route("/", name="account_home")
     */
    public function home(MemberService $memberService, OperationService $operationService, AccountService $accountService, ReportService $reportService): Response
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
    public function list(BankService $bankService): Response
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
    public function listActions(Request $request, AccountService $accountService, BankService $bankService, BankRepository $bankRepository): Response
    {
        $accountsId = (array) $request->request->get('accountsId');
        $banks = $bankRepository->findBy(['bankId' => (array) $request->request->get('banksId')]);

        $member = $this->getUser();

        if ($request->request->has('close')) {
            array_walk($banks, function (Bank $bank): void { $this->denyAccessUnlessGranted('BANK_CLOSE', $bank); });

            $accountService->close($member, $accountsId);
            $bankService->close($banks);
            $this->addFlash('success', 'account.close_confirmation');
        } elseif ($request->request->has('delete')) {
            array_walk($banks, function (Bank $bank): void { $this->denyAccessUnlessGranted('BANK_DELETE', $bank); });

            $accountService->delete($member, $accountsId);
            $bankService->delete($banks);
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
    public function create(Request $request, AccountService $accountService, ?Bank $bank): Response
    {
        $member = $this->getUser();

        $accountForm = $accountService->getCreateForm($member, $bank);
        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($account = $accountService->saveForm($member, null, $accountForm)) {
                $this->addFlash('success', 'account.form_confirmation');

                return $this->redirectToRoute(
                    'operation_list',
                    ['accountId' => $account->getAccountId()]
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
    public function update(Request $request, AccountService $accountService, Account $account): Response
    {
        $member = $this->getUser();

        $accountForm = $accountService->getUpdateForm($member, $account);
        $accountForm->handleRequest($request);

        if ($accountForm->isSubmitted()) {
            if ($accountService->saveForm($member, $account, $accountForm)) {
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
    public function importProgress(MemberService $memberService): Response
    {
        $data = [];

        $progress = $memberService->getImportProgress($this->getUser());
        if (null !== $progress) {
            foreach ($progress as $v) {
                $data[$v->getAccount()->getAccountId()] = $v->getProgressPct();
            }
        }

        return new JsonResponse($data);
    }
}
