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
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\HttpFoundation\Request,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Form\BankForm,
    Krevindiou\BagheeraBundle\Service\AccountService;

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
     * @var FormFactory
     */
    protected $_formFactory;

    /**
     * @var AccountService
     */
    protected $_accountService;


    public function __construct(
        EntityManager $em,
        FormFactory $formFactory,
        AccountService $accountService)
    {
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_accountService = $accountService;
    }

    /**
     * Returns bank form
     *
     * @param  Bank $bank       Bank entity
     * @param  array $values    Post data
     * @return Form
     */
    public function getForm(Bank $bank, array $values = array())
    {
        $form = $this->_formFactory->create(new BankForm(), $bank);
        $form->bind($values);

        return $form;
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

    /**
     * Get bank balance
     *
     * @return float
     */
    public function getBalance(Bank $bank)
    {
        $balance = 0;
        $accounts = $bank->getAccounts();
        foreach ($accounts as $account) {
            $balance+= $this->_accountService->getBalance($account);
        }

        return sprintf('%.2f', $balance);
    }
}
