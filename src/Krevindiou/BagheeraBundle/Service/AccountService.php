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
    Symfony\Component\Form\FormFactory,
    Symfony\Component\Validator\Validator,
    Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Entity\User,
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
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var FormFactory
     */
    protected $_formFactory;

    /**
     * @var Validator
     */
    protected $_validator;


    public function __construct(Logger $logger, EntityManager $em, FormFactory $formFactory, Validator $validator)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
    }

    /**
     * Returns account form
     *
     * @param  User $user       User entity
     * @param  Account $account Account entity
     * @return Form
     */
    public function getForm(User $user, Account $account = null)
    {
        if (null === $account) {
            $account = new Account();
        } elseif ($user !== $account->getBank()->getUser()) {
            return;
        }

        $form = $this->_formFactory->create(new AccountForm($user), $account);

        return $form;
    }

    /**
     * Saves account
     *
     * @param  User $user       User entity
     * @param  Account $account Account entity
     * @return boolean
     */
    public function save(User $user, Account $account)
    {
        if (null !== $account->getAccountId()) {
            $oldAccount = $this->_em->getUnitOfWork()->getOriginalEntityData($account);

            if ($user !== $oldAccount['bank']->getUser()) {
                return false;
            }
        }

        $errors = $this->_validator->validate($account);
        if (0 == count($errors)) {
            if ($user === $account->getBank()->getUser()) {
                try {
                    $this->_em->persist($account);
                    $this->_em->flush();

                    return true;
                } catch (\Exception $e) {
                    $this->_logger->err($e->getMessage());
                }
            }
        }

        return false;
    }

    /**
     * Deletes accounts
     *
     * @param  User $user        User entity
     * @param  array $accountsId Accounts id to delete
     * @return boolean
     */
    public function delete(User $user, array $accountsId)
    {
        try {
            foreach ($accountsId as $accountId) {
                $account = $this->_em->find('KrevindiouBagheeraBundle:Account', $accountId);

                if (null !== $account) {
                    if ($user === $account->getBank()->getUser()) {
                        $account->setIsDeleted(true);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Gets account balance
     *
     * @param  User $user              User entity
     * @param  Account $account        Account entity
     * @param  boolean $reconciledOnly Only consider reconciled operations
     * @return float
     */
    public function getBalance(User $user, Account $account, $reconciledOnly = false)
    {
        $balance = 0;

        if ($user === $account->getBank()->getUser()) {
            $dql = 'SELECT (SUM(o.credit) - SUM(o.debit)) ';
            $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
            $dql.= 'WHERE o.account = :account ';
            if ($reconciledOnly) {
                $dql.= 'AND o.isReconciled = 1 ';
            }

            $query = $this->_em->createQuery($dql);
            $query->setParameter('account', $account);
            $balance = $account->getInitialBalance() + $query->getSingleScalarResult();
        }

        return sprintf('%.2f', $balance);
    }
}
