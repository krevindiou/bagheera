<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller,
    Symfony\Component\HttpFoundation\Request,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template,
    Krevindiou\BagheeraBundle\Entity\Bank;

class BankController extends Controller
{
    /**
     * @Route("/edit-bank-{bankId}", requirements={"bankId" = "\d+"}, name="bank_edit")
     * @Route("/new-bank", defaults={"bankId" = null}, name="bank_new")
     * @Template()
     */
    public function formAction(Request $request, Bank $bank = null)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $bankForm = $this->get('bagheera.bank')->getForm($user, $bank);
        if (null === $bankForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $bankForm->bind($request);

            if ($this->get('bagheera.bank')->saveForm($user, $bankForm)) {
                if ('bank_new' == $request->get('_route') && null !== $bankForm->getData()->getProvider()) {
                    return $this->redirect(
                        $this->generateUrl('bank_access_edit', array('bankId' => $bankForm->getData()->getBankId()))
                    );
                } else {
                    $this->get('session')->getFlashBag()->add('success', 'bank_form_confirmation');

                    return $this->redirect($this->generateUrl('account_list'));
                }
            }
        }

        return array(
            'bankForm' => $bankForm->createView()
        );
    }

    /**
     * @Route("/import-bank-{bankId}", requirements={"bankId" = "\d+"}, name="bank_import")
     */
    public function importAction(Bank $bank)
    {
        $this->get('bagheera.bank')->importExternalBank($bank);

        return $this->redirect($this->generateUrl('account_list'));
    }
}
