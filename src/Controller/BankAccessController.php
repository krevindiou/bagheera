<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use App\Entity\Bank;

/**
 * @Route("/manager")
 */
class BankAccessController extends Controller
{
    /**
     * @Route("/bank-{bankId}/access", requirements={"bankId" = "\d+"}, name="bank_access_update")
     */
    public function formAction(Request $request, Bank $bank)
    {
        $member = $this->getUser();

        $bankAccessForm = $this->get('app.bank_access')->getForm($member, $bank);
        if (null === $bankAccessForm) {
            throw $this->createNotFoundException();
        }

        $bankAccessForm->handleRequest($request);

        if ($bankAccessForm->isSubmitted()) {
            if ($this->get('app.bank_access')->saveForm($member, $bankAccessForm)) {
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
