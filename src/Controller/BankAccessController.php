<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Bank;
use App\Service\BankAccessService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/manager")
 */
class BankAccessController extends AbstractController
{
    /**
     * @Route("/bank-{bankId}/access", requirements={"bankId" = "\d+"}, name="bank_access_update")
     */
    public function form(Request $request, BankAccessService $bankAccessService, Bank $bank): Response
    {
        $member = $this->getUser();

        $bankAccessForm = $bankAccessService->getForm($member, $bank);
        $bankAccessForm->handleRequest($request);

        if ($bankAccessForm->isSubmitted() && $bankAccessService->saveForm($member, $bankAccessForm)) {
            $this->addFlash('success', 'bank_access.form_confirmation');

            return $this->redirectToRoute('account_list');
        }

        return $this->render(
            'BankAccess/form.html.twig',
            [
                'bankAccessForm' => $bankAccessForm->createView(),
            ]
        );
    }
}
