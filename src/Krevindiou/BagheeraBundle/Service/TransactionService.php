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
    Krevindiou\BagheeraBundle\Entity\Transaction,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Form\TransactionForm;

/**
 * Transaction service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class TransactionService
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
     * Returns transaction form
     *
     * @param  Transaction $transaction     Transaction entity
     * @param  Request $request             Post data
     * @return Form
     */
    public function getForm(Transaction $transaction, Request $request)
    {
        $form = $this->_formFactory->create(new TransactionForm(), $transaction);

        if ($request->getMethod() == 'POST') {
            $form->bindRequest($request);
        }

        return $form;
    }

    /**
     * Saves form values to database
     *
     * @param  Form $transactionForm Form to get values from
     * @return boolean
     */
    public function save(Form $transactionForm)
    {
        $transaction = $transactionForm->getData();

        $debitCredit = $transactionForm->get('debitCredit')->getData();
        $amount = $transactionForm->get('amount')->getData();
        $transferAccount = $transactionForm->get('transferAccount')->getData();

        if ('debit' == $debitCredit) {
            $transaction->setDebit($amount);
            $transaction->setCredit(null);
        } else {
            $transaction->setDebit(null);
            $transaction->setCredit($amount);
        }

        if ($transactionForm->isValid()) {
            if (!in_array($transaction->getPaymentMethod()->getPaymentMethodId(), array(4, 6))) {
                $transferAccount = null;
            }

            $transferTransactionBeforeSave = null;
            if (null !== $transaction->getTransactionId()) {
                $transactionBeforeSave = $this->_em->find(
                    'KrevindiouBagheeraBundle:Transaction',
                    $transaction->getTransactionId()
                );

                if (null !== $transactionBeforeSave->getTransferTransaction()) {
                    $transferTransactionBeforeSave = $transactionBeforeSave->getTransferTransaction();
                }
            }

            if (null !== $transferAccount) {
                // update transfer => transfer
                if (null !== $transferTransactionBeforeSave) {
                    $transferTransaction = $transaction->getTransferTransaction();

                // update check => transfer
                } else {
                    $transferTransaction = new Transaction();
                    $transferTransaction->setScheduler($transaction->getScheduler());
                    $transferTransaction->setTransferTransaction($transaction);

                    $transaction->setTransferTransaction($transferTransaction);
                }

                $transferTransaction->setAccount($transferAccount);
                $transferTransaction->setDebit($transaction->getCredit());
                $transferTransaction->setCredit($transaction->getDebit());
                $transferTransaction->setThirdParty($transaction->getThirdParty());
                $transferTransaction->setCategory($transaction->getCategory());
                $transferTransaction->setPaymentMethod(
                    $this->_em->find(
                        'KrevindiouBagheeraBundle:PaymentMethod',
                        (4 == $transaction->getPaymentMethod()->getPaymentMethodId()) ? 6 : 4
                    )
                );
                $transferTransaction->setValueDate($transaction->getValueDate());
                $transferTransaction->setNotes($transaction->getNotes());

                try {
                    $this->_em->persist($transferTransaction);
                } catch (\Exception $e) {
                    return false;
                }
            } else {
                // update transfer => check
                if (null !== $transferTransactionBeforeSave) {
                    $transaction->setTransferTransaction(null);

                    try {
                        $this->_em->remove($transferTransactionBeforeSave);
                    } catch (\Exception $e) {
                        return false;
                    }
                }
            }

            try {
                $this->_em->persist($transaction);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                return false;
            }
        }

        return false;
    }

    /**
     * Deletes objects from database
     *
     * @param  array $transactionsId Transactions id to delete
     * @return boolean
     */
    public function delete(array $transactionsId)
    {
        foreach ($transactionsId as $transactionId) {
            $transaction = $this->_em->find('KrevindiouBagheeraBundle:Transaction', $transactionId);

            if (null !== $transaction) {
                try {
                    $this->_em->remove($transaction);
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
     * Reconciles transactions
     *
     * @param  array $transactionsId Transactions id to reconcile
     * @return boolean
     */
    public function reconcile(array $transactionsId)
    {
        foreach ($transactionsId as $transactionId) {
            $transaction = $this->_em->find('KrevindiouBagheeraBundle:Transaction', $transactionId);

            if (null !== $transaction) {
                try {
                    $transaction->setIsReconciled(true);
                    $this->_em->persist($transaction);
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
     * Gets transactions list
     *
     * @param  Account $account Account entity
     * @param  integer $page    Page number
     * @return array
     */
    public function getTransactions(Account $account, $page = 1)
    {
        $dql = 'SELECT t ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'WHERE t.account = :account ';
        $dql.= 'ORDER BY t.valueDate DESC ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('account', $account);

        return $query->getResult();
    }
}
