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
    Krevindiou\BagheeraBundle\Entity\Operation,
    Krevindiou\BagheeraBundle\Entity\Account,
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


    public function __construct(EntityManager $em, FormFactory $formFactory)
    {
        $this->_em = $em;
        $this->_formFactory = $formFactory;
    }

    /**
     * Returns operation form
     *
     * @param  Operation $operation Operation entity
     * @param  array $values        Post data
     * @return Form
     */
    public function getForm(Operation $operation, array $values = null)
    {
        $form = $this->_formFactory->create(new OperationForm(), $operation);
        if (null !== $values) {
            $form->bind($values);
        }

        return $form;
    }

    /**
     * Saves operation
     *
     * @param  Operation $operation     Operation entity
     * @param  string $debitCredit      'debit' or 'credit'
     * @param  float $amount            Operation amount
     * @param  Account $transferAccount Operation transferAccount
     * @return boolean
     */
    public function save(Operation $operation, $debitCredit = null, $amount = null, Account $transferAccount = null)
    {
        if (null !== $debitCredit && null !== $amount) {
            if ('debit' == $debitCredit) {
                $operation->setDebit($amount);
                $operation->setCredit(null);
            } else {
                $operation->setDebit(null);
                $operation->setCredit($amount);
            }
        }

        if (!in_array($operation->getPaymentMethod()->getPaymentMethodId(), array(4, 6))) {
            $transferAccount = null;
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

        if (null !== $transferAccount) {
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

            $transferOperation->setAccount($transferAccount);
            $transferOperation->setDebit($operation->getCredit());
            $transferOperation->setCredit($operation->getDebit());
            $transferOperation->setThirdParty($operation->getThirdParty());
            $transferOperation->setCategory($operation->getCategory());
            $transferOperation->setPaymentMethod(
                $this->_em->find(
                    'KrevindiouBagheeraBundle:PaymentMethod',
                    (4 == $operation->getPaymentMethod()->getPaymentMethodId()) ? 6 : 4
                )
            );
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
        } catch (\Exception $e) {
            return false;
        }

        return false;
    }

    /**
     * Deletes operations
     *
     * @param  array $operationsId Operations id to delete
     * @return boolean
     */
    public function delete(array $operationsId)
    {
        foreach ($operationsId as $operationId) {
            $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', $operationId);

            if (null !== $operation) {
                try {
                    $this->_em->remove($operation);
                } catch (\Exception $e) {
                    return false;
                }
            }
        }

        try {
            $this->_em->flush();
        } catch (\Exception $e) {
            return false;
        }

        return true;
    }

    /**
     * Reconciles operations
     *
     * @param  array $operationsId Operations id to reconcile
     * @return boolean
     */
    public function reconcile(array $operationsId)
    {
        foreach ($operationsId as $operationId) {
            $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', $operationId);

            if (null !== $operation) {
                try {
                    $operation->setIsReconciled(true);
                    $this->_em->persist($operation);
                } catch (\Exception $e) {
                    return false;
                }
            }
        }

        try {
            $this->_em->flush();
        } catch (\Exception $e) {
            return false;
        }

        return true;
    }

    /**
     * Gets operations list
     *
     * @param  Account $account Account entity
     * @param  integer $page    Page number
     * @return array
     */
    public function getOperations(Account $account, $page = 1)
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = :account ';
        $dql.= 'ORDER BY o.valueDate DESC ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('account', $account);

        return $query->getResult();
    }
}
