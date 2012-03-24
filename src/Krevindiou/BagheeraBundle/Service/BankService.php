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

    /**
     * @var AccountService
     */
    protected $_accountService;


    public function __construct(
        Logger $logger,
        EntityManager $em,
        FormFactory $formFactory,
        Validator $validator,
        AccountService $accountService)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_accountService = $accountService;
    }

    /**
     * Returns bank form
     *
     * @param  User $user User entity
     * @param  Bank $bank Bank entity
     * @return Form
     */
    public function getForm(User $user, Bank $bank = null)
    {
        if (null === $bank) {
            $bank = new Bank();
            $bank->setUser($user);
        } elseif ($user !== $bank->getUser()) {
            return;
        }

        $form = $this->_formFactory->create(new BankForm(), $bank);

        return $form;
    }

    /**
     * Saves bank
     *
     * @param  User $user User entity
     * @param  Bank $bank Bank entity
     * @return boolean
     */
    public function save(User $user, Bank $bank)
    {
        if ($user === $bank->getUser()) {
            $errors = $this->_validator->validate($bank);

            if (0 == count($errors)) {
                try {
                    $this->_em->persist($bank);
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
     * Deletes banks
     *
     * @param  User $user     User entity
     * @param  array $banksId Banks id to delete
     * @return boolean
     */
    public function delete(User $user, array $banksId)
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->_em->find('KrevindiouBagheeraBundle:Bank', $bankId);

                if (null !== $bank) {
                    if ($user === $bank->getUser()) {
                        $this->_em->remove($bank);
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
     * Gets bank balance
     *
     * @param  User $user User entity
     * @param  Bank $bank Bank entity
     * @return float
     */
    public function getBalance(User $user, Bank $bank)
    {
        $balance = 0;

        if ($user === $bank->getUser()) {
            $accounts = $bank->getAccounts();
            foreach ($accounts as $account) {
                $balance+= $this->_accountService->getBalance($user, $account);
            }

        }

        return sprintf('%.2f', $balance);
    }
}
