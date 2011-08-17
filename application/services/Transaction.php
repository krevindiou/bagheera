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

namespace Application\Services;

use Application\Models\Transaction as TransactionModel,
    Application\Models\Account as AccountModel,
    Application\Forms\Transaction as TransactionForm;

/**
 * Transaction service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Transaction extends CrudAbstract
{
    public function getForm(TransactionModel $transaction = null, array $extraValues = null)
    {
        if (null === $transaction) {
            $transaction = new TransactionModel();
        }

        if ('' == $transaction->getValueDate()) {
            $transaction->setValueDate(new \DateTime);
        }

        $account = $transaction->getAccount();
        $category = $transaction->getCategory();
        $paymentMethod = $transaction->getPaymentMethod();
        $transferAccount = null;
        if (null !== $transaction->getTransferTransaction()) {
            $transferAccount = $transaction->getTransferTransaction()->getAccount();
        }
        $debit = $transaction->getDebit();
        $credit = $transaction->getCredit();

        if (!isset($extraValues['accountId']) && null !== $account) {
            $extraValues['accountId'] = $account->getAccountId();
        }
        if (!isset($extraValues['categoryId']) && null !== $category) {
            $extraValues['categoryId'] = $category->getCategoryId();
        }
        if (!isset($extraValues['paymentMethodId']) && null !== $paymentMethod) {
            $extraValues['paymentMethodId'] = $paymentMethod->getPaymentMethodId();
        }
        if (!isset($extraValues['transferAccountId']) && null !== $transferAccount) {
            $extraValues['transferAccountId'] = $transferAccount->getAccountId();
        }
        if (!isset($extraValues['amount'])) {
            $extraValues['amount'] = ($debit > 0) ? $debit : $credit;
        }
        if (!isset($extraValues['debitCredit'])) {
            if ($debit > 0) {
                $extraValues['debitCredit'] = 'debit';
            } elseif ($credit > 0) {
                $extraValues['debitCredit'] = 'credit';
            }
        }
        if (!isset($extraValues['isReconciled'])) {
            $extraValues['isReconciled'] = (int)$transaction->getIsReconciled();
        }

        return parent::getForm(new TransactionForm(), $transaction, $extraValues);
    }

    public function getTransactions(AccountModel $account, $page = 1)
    {
        $dql = 'SELECT t ';
        $dql.= 'FROM Application\\Models\\Transaction t ';
        $dql.= 'WHERE t._account = :account ';
        $dql.= 'ORDER BY t._valueDate DESC ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('account', $account);

        $paginator = new \Zend_Paginator(new \DoctrineExtensions\Paginate\PaginationAdapter($query));
        $paginator->setCurrentPageNumber($page);

        return $paginator;
    }

    public function save(TransactionForm $transactionForm)
    {
        $amount = $transactionForm->getElement('amount')->getValue();
        $debitCredit = $transactionForm->getElement('debitCredit')->getValue();

        if ('credit' == $debitCredit) {
            $debit = 0;
            $credit = $amount;
        } else {
            $debit = $amount;
            $credit = 0;
        }

        $values = array(
            'account' => $this->_em->find(
                'Application\\Models\\Account',
                $transactionForm->getElement('accountId')->getValue()
            ),
            'category' => $this->_em->find(
                'Application\\Models\\Category',
                $transactionForm->getElement('categoryId')->getValue()
            ),
            'paymentMethod' => $this->_em->find(
                'Application\\Models\\PaymentMethod',
                $transactionForm->getElement('paymentMethodId')->getValue()
            ),
            'debit' => $debit,
            'credit' => $credit,
        );

        $internalTransferAccount = null;
        if (
            null !== $values['paymentMethod'] &&
            in_array($values['paymentMethod']->getPaymentMethodId(), array(4, 6)) &&
            null !== $transactionForm->getElement('transferAccountId')->getValue()
        ) {
            $internalTransferAccount = $this->_em->find(
                'Application\\Models\\Account',
                $transactionForm->getElement('transferAccountId')->getValue()
            );
        }

        $transaction = $transactionForm->getEntity();
        $internalTransferAccountBeforeSave = $transaction->getTransferTransaction();

        if ('' != $transactionForm->getElement('transactionId')->getValue()) {
            $saveOk = parent::update($transactionForm, $values);
        } else {
            $saveOk = parent::add($transactionForm, $values);
        }

        if ($saveOk) {
            if (null !== $internalTransferAccount) {
                // update transfer => transfer
                if (null !== $internalTransferAccountBeforeSave) {
                    $transferTransaction = $transaction->getTransferTransaction();
                    $transferTransaction->setUpdatedAt(new \DateTime);

                // update check => transfer
                } else {
                    $transferTransaction = new TransactionModel();
                    $transferTransaction->setScheduler($transaction->getScheduler());
                    $transferTransaction->setTransferTransaction($transaction);
                    $transferTransaction->setCreatedAt(new \DateTime);
                    $transferTransaction->setUpdatedAt(new \DateTime);

                    $transaction->setTransferTransaction($transferTransaction);
                    $this->_em->persist($transaction);
                }

                $transferTransaction->setAccount(
                    $this->_em->find(
                        'Application\\Models\\Account',
                        $transactionForm->getElement('transferAccountId')->getValue()
                    )
                );

                $transferTransaction->setDebit($transaction->getCredit());
                $transferTransaction->setCredit($transaction->getDebit());
                $transferTransaction->setThirdParty($transaction->getThirdParty());
                $transferTransaction->setCategory($transaction->getCategory());
                $transferTransaction->setPaymentMethod(
                    $this->_em->find(
                        'Application\\Models\\PaymentMethod',
                        (4 == $transaction->getPaymentMethod()->getPaymentMethodId()) ? 6 : 4
                    )
                );
                $transferTransaction->setValueDate($transaction->getValueDate());
                $transferTransaction->setNotes($transaction->getNotes());

                $this->_em->persist($transferTransaction);
                $this->_em->flush();
            } else {
                // update transfer => check
                if (null !== $internalTransferAccountBeforeSave) {
                    $transaction = $transactionForm->getEntity();
                    $transaction->setTransferTransaction(null);
                    $this->_em->persist($transaction);
                    $this->_em->remove($internalTransferAccountBeforeSave);
                    $this->_em->flush();
                }
            }
        }

        return $saveOk;
    }

    public function delete(array $transactionsId)
    {
        foreach ($transactionsId as $transactionId) {
            $transaction = $this->_em->find(
                'Application\\Models\\Transaction',
                $transactionId
            );

            if (null !== $transaction) {
                parent::delete($transaction);
            }
        }
    }

    public function reconcile(array $transactionsId)
    {
        foreach ($transactionsId as $transactionId) {
            $transaction = $this->_em->find(
                'Application\\Models\\Transaction',
                $transactionId
            );

            if (null !== $transaction) {
                $transaction->setIsReconciled(true);
                $this->_em->persist($transaction);
            }
        }

        $this->_em->flush();
    }
}
