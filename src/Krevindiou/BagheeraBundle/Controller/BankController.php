<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use Krevindiou\BagheeraBundle\Entity\Bank;

/**
 * @Route("/manager")
 */
class BankController extends Controller
{
    /**
     * @Route("/bank-{bankId}", requirements={"bankId" = "\d+"}, name="bank_edit")
     * @Route("/new-bank", defaults={"bankId" = null}, name="bank_new")
     * @Template()
     */
    public function formAction(Request $request, Bank $bank = null)
    {
        $member = $this->getUser();

        $bankForm = $this->get('bagheera.bank')->getForm($member, $bank);
        if (null === $bankForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $bankForm->bind($request);

            if ($this->get('bagheera.bank')->saveForm($member, $bankForm)) {
                if ('bank_new' == $request->get('_route') && null !== $bankForm->getData()->getProvider()) {
                    return $this->redirect(
                        $this->generateUrl('bank_access_edit', ['bankId' => $bankForm->getData()->getBankId()])
                    );
                } else {
                    $this->get('session')->getFlashBag()->add('success', 'bank.form_confirmation');

                    return $this->redirect($this->generateUrl('account_list'));
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
        $this->get('bagheera.bank')->importExternalBank($bank);

        return $this->redirect($this->generateUrl('account_list'));
    }
}
