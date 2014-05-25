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
class BankAccessController extends Controller
{
    /**
     * @Route("/bank-{bankId}/access", requirements={"bankId" = "\d+"}, name="bank_access_edit")
     * @Template()
     */
    public function formAction(Request $request, Bank $bank)
    {
        $member = $this->getUser();

        $bankAccessForm = $this->get('bagheera.bank_access')->getForm($member, $bank);
        if (null === $bankAccessForm) {
            throw $this->createNotFoundException();
        }

        $bankAccessForm->handleRequest($request);

        if ($bankAccessForm->isSubmitted()) {
            if ($this->get('bagheera.bank_access')->saveForm($member, $bankAccessForm)) {
                $this->get('session')->getFlashBag()->add('success', 'bank_access.form_confirmation');

                return $this->redirect($this->generateUrl('account_list'));
            }
        }

        return [
            'bankAccessForm' => $bankAccessForm->createView()
        ];
    }
}
