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
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Operation,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\PaymentMethod,
    Krevindiou\BagheeraBundle\Form\OperationForm;

/**
 * Operation service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationService
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
     * @var Validator
     */
    protected $_validator;


    public function __construct(EntityManager $em, FormFactory $formFactory, Validator $validator)
    {
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
    }

    /**
     * Returns operations list
     *
     * @param  User $user       User entity
     * @param  Account $account Account entity
     * @param  integer $page    Page number
     * @return array
     */
    public function getList(User $user, Account $account, $page = 1)
    {
        if ($account->getBank()->getUser() == $user) {
            return $this->_em->getRepository('KrevindiouBagheeraBundle:Operation')->findBy(
                array('account' => $account->getAccountId()),
                array('valueDate' => 'DESC')
            );
        }
    }

    /**
     * Returns operation form
     *
     * @param  User $user           User entity
     * @param  Operation $operation Operation entity
     * @param  Account $account     Account entity for new operation
     * @return Form
     */
    public function getForm(User $user, Operation $operation = null, Account $account = null)
    {
        if (null === $operation && null !== $account) {
            $operation = new Operation();
            $operation->setAccount($account);
        } elseif (null !== $operation && $user !== $operation->getAccount()->getBank()->getUser()) {
            return;
        }

        $form = $this->_formFactory->create(
            new OperationForm($account ? : $operation->getAccount()),
            $operation
        );

        return $form;
    }

    /**
     * Saves operation
     *
     * @param  User $user           User entity
     * @param  Operation $operation Operation entity
     * @return boolean
     */
    public function save(User $user, Operation $operation)
    {
        if (null !== $operation->getOperationId()) {
            $oldOperation = $this->_em->getUnitOfWork()->getOriginalEntityData($operation);

            if ($user !== $oldOperation['account']->getBank()->getUser()) {
                return false;
            }
        }

        $errors = $this->_validator->validate($operation);
        if (0 == count($errors)) {
            if ($user === $operation->getAccount()->getBank()->getUser()) {
                if (!in_array(
                    $operation->getPaymentMethod()->getPaymentMethodId(),
                    array(
                        PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER,
                        PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                    )
                )) {
                    $operation->setTransferAccount(null);
                }

                $transferOperationBeforeSave = null;
                if (null !== $operation->getOperationId()) {
                    $operationBeforeSave = $this->_em->find(
                        'KrevindiouBagheeraBundle:Operation',
                        $operation->getOperationId()
                    );

                    if (null !== $operationBeforeSave->getTransferOperation()) {
                        $transferOperationBeforeSave = $operationBeforeSave->getTransferOperation();
                    }
                }

                if (null !== $operation->getTransferAccount()) {
                    // update transfer => transfer
                    if (null !== $transferOperationBeforeSave) {
                        $transferOperation = $operation->getTransferOperation();

                    // update check => transfer
                    } else {
                        $transferOperation = new Operation();
                        $transferOperation->setScheduler($operation->getScheduler());
                        $transferOperation->setTransferOperation($operation);

                        $operation->setTransferOperation($transferOperation);
                    }

                    if (PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER == $operation->getPaymentMethod()->getPaymentMethodId()) {
                        $paymentMethod = $this->_em->find(
                            'KrevindiouBagheeraBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                        );
                    } else {
                        $paymentMethod = $this->_em->find(
                            'KrevindiouBagheeraBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER
                        );
                    }

                    $transferOperation->setAccount($operation->getTransferAccount());
                    $transferOperation->setTransferAccount($operation->getAccount());
                    $transferOperation->setDebit($operation->getCredit());
                    $transferOperation->setCredit($operation->getDebit());
                    $transferOperation->setThirdParty($operation->getThirdParty());
                    $transferOperation->setCategory($operation->getCategory());
                    $transferOperation->setPaymentMethod($paymentMethod);
                    $transferOperation->setValueDate($operation->getValueDate());
                    $transferOperation->setNotes($operation->getNotes());

                    try {
                        $this->_em->persist($transferOperation);
                    } catch (\Exception $e) {
                        return false;
                    }
                } else {
                    // update transfer => check
                    if (null !== $transferOperationBeforeSave) {
                        $operation->setTransferOperation(null);

                        try {
                            $this->_em->remove($transferOperationBeforeSave);
                        } catch (\Exception $e) {
                            return false;
                        }
                    }
                }

                try {
                    $this->_em->persist($operation);
                    $this->_em->flush();

                    return true;
                } catch (\Exception $e) {;
                }
            }
        }

        return false;
    }

    /**
     * Deletes operations
     *
     * @param  User $user          User entity
     * @param  array $operationsId Operations id to delete
     * @return boolean
     */
    public function delete(User $user, array $operationsId)
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', $operationId);

                if (null !== $operation) {
                    if ($user === $operation->getAccount()->getBank()->getUser()) {
                        $this->_em->remove($operation);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            return false;
        }

        return true;
    }

    /**
     * Reconciles operations
     *
     * @param  User $user          User entity
     * @param  array $operationsId Operations id to reconcile
     * @return boolean
     */
    public function reconcile(User $user, array $operationsId)
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', $operationId);

                if (null !== $operation) {
                    if ($user === $operation->getAccount()->getBank()->getUser()) {
                        $operation->setIsReconciled(true);
                        $this->_em->persist($operation);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            return false;
        }

        return true;
    }
}
