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
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Form\AccountForm;

/**
 * Account service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountService
{
    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var FormFactory
     */
    protected $_formFactory;


    public function __construct(
        EntityManager $em,
        FormFactory $formFactory)
    {
        $this->_em = $em;
        $this->_formFactory = $formFactory;
    }

    /**
     * Returns account form
     *
     * @param  Account $account Account entity
     * @param  Request $request Post data
     * @return Form
     */
    public function getForm(Account $account, Request $request)
    {
        $form = $this->_formFactory->create(new AccountForm(), $account);

        if ($request->getMethod() == 'POST') {
            $form->bindRequest($request);
        }

        return $form;
    }

    /**
     * Saves form values to database
     *
     * @param  Form $accountForm Form to get values from
     * @return boolean
     */
    public function save(Form $accountForm)
    {
        if ($accountForm->isValid()) {
            $account = $accountForm->getData();

            try {
                $this->_em->persist($account);
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
     * @param  Account $account Object to delete
     * @return boolean
     */
    public function delete(Account $account)
    {
        try {
            $this->_em->remove($account);
            $this->_em->flush();

            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get account balance
     *
     * @return float
     */
    public function getBalance(Account $account, $reconciledOnly = false)
    {
        $dql = 'SELECT (SUM(t.credit) - SUM(t.debit)) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'WHERE t.account = :account ';
        if ($reconciledOnly) {
            $dql.= 'AND t.isReconciled = 1 ';
        }

        $query = $this->_em->createQuery($dql);
        $query->setParameter('account', $account);
        $balance = $query->getSingleScalarResult();

        return sprintf('%.2f', $account->getInitialBalance() + $balance);
    }
}
