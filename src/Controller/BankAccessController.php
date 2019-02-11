<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use App\Entity\Bank;
use App\Service\BankAccessService;

/**
 * @Route("/manager")
 */
class BankAccessController extends Controller
{
    /**
     * @Route("/bank-{bankId}/access", requirements={"bankId" = "\d+"}, name="bank_access_update")
     */
    public function formAction(Request $request, BankAccessService $bankAccessService, Bank $bank)
    {
        $member = $this->getUser();

        $bankAccessForm = $bankAccessService->getForm($member, $bank);
        if (null === $bankAccessForm) {
            throw $this->createNotFoundException();
        }

        $bankAccessForm->handleRequest($request);

        if ($bankAccessForm->isSubmitted()) {
            if ($bankAccessService->saveForm($member, $bankAccessForm)) {
                $this->addFlash('success', 'bank_access.form_confirmation');

                return $this->redirectToRoute('account_list');
            }
        }

        return $this->render(
            'BankAccess/form.html.twig',
            [
                'bankAccessForm' => $bankAccessForm->createView(),
            ]
        );
    }
}
