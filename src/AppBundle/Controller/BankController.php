<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use AppBundle\Entity\Bank;

/**
 * @Route("/manager")
 */
class BankController extends Controller
{
    /**
     * @Route("/bank-{bankId}", requirements={"bankId" = "\d+"}, name="bank_update")
     * @Route("/choose-bank", defaults={"bankId" = null}, name="bank_choose")
     * @Template()
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
                        $this->get('session')->getFlashBag()->add('success', 'bank.form_confirmation');

                        return $this->redirect(
                            $this->generateUrl('bank_access_update', ['bankId' => $bank->getBankId()])
                        );
                    } else {
                        return $this->redirect(
                            $this->generateUrl('account_create_with_bank', ['bankId' => $bank->getBankId()])
                        );
                    }
                } else {
                    $this->get('session')->getFlashBag()->add('success', 'bank.form_confirmation');

                    return $this->redirect(
                        $this->generateUrl($request->get('_route'), ['bankId' => $bank->getBankId()])
                    );
                }
            }
        }

        return [
            'bankForm' => $bankForm->createView()
        ];
    }

    /**
     * @Route("/bank-{bankId}/import", requirements={"bankId" = "\d+"}, name="bank_import")
     */
    public function importAction(Bank $bank)
    {
        $this->get('app.bank')->importExternalBank($bank);

        return $this->redirect($this->generateUrl('account_list'));
    }
}
