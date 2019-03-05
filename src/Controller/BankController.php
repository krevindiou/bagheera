<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Bank;
use App\Service\BankService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/manager")
 */
class BankController extends AbstractController
{
    /**
     * @Route("/bank-{bankId}", requirements={"bankId" = "\d+"}, name="bank_update")
     * @Route("/choose-bank", defaults={"bankId" = null}, name="bank_choose")
     */
    public function form(Request $request, BankService $bankService, ?Bank $bank)
    {
        $member = $this->getUser();

        $bankForm = $bankService->getForm($member, $bank);
        $bankForm->handleRequest($request);

        if ($bankForm->isSubmitted()) {
            if ($bank = $bankService->saveForm($member, $bank, $bankForm->getData())) {
                if ('bank_choose' === $request->get('_route')) {
                    if (null !== $bank->getProvider()) {
                        $this->addFlash('success', 'bank.form_confirmation');

                        return $this->redirectToRoute('bank_access_update', ['bankId' => $bank->getBankId()]);
                    }

                    return $this->redirectToRoute('account_create_with_bank', ['bankId' => $bank->getBankId()]);
                }
                $this->addFlash('success', 'bank.form_confirmation');

                return $this->redirectToRoute($request->get('_route'), ['bankId' => $bank->getBankId()]);
            }
        }

        return $this->render(
            'Bank/form.html.twig',
            [
                'bankForm' => $bankForm->createView(),
            ]
        );
    }

    /**
     * @Route("/bank-{bankId}/import", requirements={"bankId" = "\d+"}, name="bank_import")
     */
    public function import(Bank $bank, BankService $bankService)
    {
        $bankService->importExternalBank($bank);

        return $this->redirectToRoute('account_list');
    }
}
