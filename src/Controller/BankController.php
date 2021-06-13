<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Bank;
use App\Service\BankService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/manager")
 */
class BankController extends AbstractController
{
    /**
     * @Route("/choose-bank", name="bank_choose")
     */
    public function choose(Request $request, BankService $bankService): Response
    {
        $bank = new Bank($this->getUser());

        $form = $bankService->getCreateForm($bank);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $bankService->saveForm($bank, $form->getData())) {
            $this->addFlash('success', 'bank.form_confirmation');

            if (null !== $bank->getProvider()) {
                return $this->redirectToRoute('bank_access_update', ['bankId' => $bank->getBankId()]);
            }

            return $this->redirectToRoute('account_create_with_bank', ['bankId' => $bank->getBankId()]);
        }

        return $this->render(
            'Bank/form.html.twig',
            [
                'bankForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/bank-{bankId}", requirements={"bankId" = "\d+"}, name="bank_update")
     */
    public function edit(Request $request, BankService $bankService, Bank $bank): Response
    {
        $this->denyAccessUnlessGranted('BANK_EDIT', $bank);

        $form = $bankService->getEditForm($bank);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $bankService->saveForm($bank, $form->getData())) {
            $this->addFlash('success', 'bank.form_confirmation');

            return $this->redirectToRoute($request->get('_route'), ['bankId' => $bank->getBankId()]);
        }

        return $this->render(
            'Bank/form.html.twig',
            [
                'bankForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/bank-{bankId}/import", requirements={"bankId" = "\d+"}, name="bank_import")
     */
    public function import(Bank $bank, BankService $bankService): Response
    {
        $bankService->importExternalBank($bank);

        return $this->redirectToRoute('account_list');
    }
}
