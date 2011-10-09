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

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Component\Security\Core\SecurityContext,
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\HttpFoundation\Request,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Service\UserService,
    Krevindiou\BagheeraBundle\Form\BankForm;

/**
 * Bank service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankService
{
    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var SecurityContext
     */
    protected $_context;

    /**
     * @var UserService
     */
    protected $_userService;

    /**
     * @var FormFactory
     */
    protected $_formFactory;


    public function __construct(
        EntityManager $em,
        SecurityContext $context,
        UserService $userService,
        FormFactory $formFactory)
    {
        $this->_em = $em;
        $this->_context = $context;
        $this->_userService = $userService;
        $this->_formFactory = $formFactory;
    }

    /**
     * Returns bank form
     *
     * @param  Bank $bank       Bank entity
     * @param  Request $request Post data
     * @return Form
     */
    public function getForm(Bank $bank = null, Request $request)
    {
        $token = $this->_context->getToken();
        if (null !== $token) {
            $user = $token->getUser();
            if (is_object($user)) {
                if (null === $bank) {
                    $bank = new Bank();
                }

                $bank->setUser($user);

                $form = $this->_formFactory->create(new BankForm(), $bank);

                if ($request->getMethod() == 'POST') {
                    $form->bindRequest($request);
                }

                return $form;
            }
        }
    }

    /**
     * Saves form values to database
     *
     * @param  Form $bankForm Form to get values from
     * @return boolean
     */
    public function save(Form $bankForm)
    {
        if ($bankForm->isValid()) {
            $bank = $bankForm->getData();

            try {
                $this->_em->persist($bank);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
            }
        }

        return false;
    }

    /**
     * Deletes object from database
     *
     * @param  Bank $bank Object to delete
     * @return boolean
     */
    public function delete(Bank $bank)
    {
        try {
            $this->_em->remove($bank);
            $this->_em->flush();

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
