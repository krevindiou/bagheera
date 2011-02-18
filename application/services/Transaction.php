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
        } else {
            $transaction = new TransactionModel();
        }

        return parent::getForm(new TransactionForm, $transaction, $params);
    }

    public function add(TransactionForm $transactionForm)
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
                1 // @todo
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

        return parent::add($transactionForm, $values);
    }

    public function update(TransactionForm $transactionForm)
    {
        return parent::update($transactionForm);
    }

    public function delete(TransactionModel $transaction)
    {
        return parent::delete($transaction);
    }
}
