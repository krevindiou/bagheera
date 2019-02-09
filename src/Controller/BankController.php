<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use App\Entity\Bank;

/**
 * @Route("/manager")
 */
class BankController extends Controller
{
    /**
     * @Route("/bank-{bankId}", requirements={"bankId" = "\d+"}, name="bank_update")
     * @Route("/choose-bank", defaults={"bankId" = null}, name="bank_choose")
     */
    public function formAction(Request $request, Bank $bank = null)
    {
        $member = $this->getUser();

        $bankForm = $this->get('app.bank')->getForm($member, $bank);
        if (null === $bankForm) {
            throw $this->createNotFoundException();
        }

        $bankForm->handleRequest($request);

        if ($bankForm->isSubmitted()) {
            if ($bank = $this->get('app.bank')->saveForm($member, $bankForm)) {
                if ('bank_choose' == $request->get('_route')) {
                    if (null !== $bank->getProvider()) {
                        $this->addFlash('success', 'bank.form_confirmation');

                        return $this->redirectToRoute('bank_access_update', ['bankId' => $bank->getBankId()]);
                    } else {
                        return $this->redirectToRoute('account_create_with_bank', ['bankId' => $bank->getBankId()]);
                    }
                } else {
                    $this->addFlash('success', 'bank.form_confirmation');

                    return $this->redirectToRoute($request->get('_route'), ['bankId' => $bank->getBankId()]);
                }
            }
        }

        return $this->render(
            'App:Bank:form.html.twig',
            [
                'bankForm' => $bankForm->createView(),
            ]
        );
    }

    /**
     * @Route("/bank-{bankId}/import", requirements={"bankId" = "\d+"}, name="bank_import")
     */
    public function importAction(Bank $bank)
    {
        $this->get('app.bank')->importExternalBank($bank);

        return $this->redirectToRoute('account_list');
    }
}
