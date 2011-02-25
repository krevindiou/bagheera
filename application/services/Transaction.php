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
    public function getForm($transactionId = null, array $params = null)
    {
        if (null !== $transactionId) {
            $transaction = $this->_em->find('Application\\Models\\Transaction', $transactionId);

            $account = $transaction->getAccount();
            $category = $transaction->getCategory();
            $paymentMethod = $transaction->getPaymentMethod();
            $transferAccount = $transaction->getTransferAccount();
            $debit = $transaction->getDebit();
            $credit = $transaction->getCredit();

            if (!isset($params['accountId']) && null !== $account) {
                $params['accountId'] = $account->getAccountId();
            }
            if (!isset($params['categoryId']) && null !== $category) {
                $params['categoryId'] = $category->getCategoryId();
            }
            if (!isset($params['paymentMethodId']) && null !== $paymentMethod) {
                $params['paymentMethodId'] = $paymentMethod->getPaymentMethodId();
            }
            if (!isset($params['transferAccountId']) && null !== $transferAccount) {
                $params['transferAccountId'] = $transferAccount->getAccountId();
            }
            if (!isset($params['amount'])) {
                $params['amount'] = ($debit > 0) ? $debit : $credit;
            }
            if (!isset($params['debitCredit'])) {
                $params['debitCredit'] = ($debit > 0) ? 'debit' : 'credit';
            }
        } else {
            $transaction = new TransactionModel();
            $transaction->setValueDate(new \DateTime);
        }

        return parent::getForm(new TransactionForm, $transaction, $params);
    }

    public function getTransactions(AccountModel $account)
    {
        $dql = 'SELECT t ';
        $dql.= 'FROM Application\\Models\\Transaction t ';
        $dql.= 'WHERE t._account = ?1 ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter(1, $account);

        $transactions = $query->getResult();

        return $transactions;
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
            'transferAccount' => $this->_em->find(
                'Application\\Models\\Account',
                $transactionForm->getElement('transferAccountId')->getValue()
            ),
            'debit' => $debit,
            'credit' => $credit,
        );

        if (!in_array($values['paymentMethod']->getPaymentMethodId(), array(4, 6))) {
            $values['transferAccount'] = null;
        }

        if ('' != $transactionForm->getElement('transactionId')->getValue()) {
            return parent::update($transactionForm, $values);
        } else {
            return parent::add($transactionForm, $values);
        }
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
