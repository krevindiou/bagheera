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
        $user = $this->getUser();

        $bankAccessForm = $this->get('bagheera.bank_access')->getForm($user, $bank);
        if (null === $bankAccessForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $bankAccessForm->bind($request);

            if ($this->get('bagheera.bank_access')->saveForm($user, $bankAccessForm)) {
                $this->get('session')->getFlashBag()->add('success', 'bank_access_form_confirmation');

                return $this->redirect($this->generateUrl('account_list'));
            }
        }

        return array(
            'bankAccessForm' => $bankAccessForm->createView()
        );
    }
}
