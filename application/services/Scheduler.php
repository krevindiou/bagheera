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

use Application\Models\Scheduler as SchedulerModel,
    Application\Models\Account as AccountModel,
    Application\Forms\Scheduler as SchedulerForm;

/**
 * Scheduler service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Scheduler extends CrudAbstract
{
    public function getForm($schedulerId = null, array $params = null)
    {
        if (null !== $schedulerId) {
            $scheduler = $this->_em->find('Application\\Models\\Scheduler', $schedulerId);

            $account = $scheduler->getAccount();
            $category = $scheduler->getCategory();
            $paymentMethod = $scheduler->getPaymentMethod();
            $transferAccount = $scheduler->getTransferAccount();
            $debit = $scheduler->getDebit();
            $credit = $scheduler->getCredit();

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
            $scheduler = new SchedulerModel();
            $scheduler->setValueDate(new \DateTime);
        }

        return parent::getForm(new SchedulerForm, $scheduler, $params);
    }

    public function getSchedulers(AccountModel $account)
    {
        $dql = 'SELECT t ';
        $dql.= 'FROM Application\\Models\\Scheduler t ';
        $dql.= 'WHERE t._account = :account ';
        $dql.= 'ORDER BY t._valueDate DESC ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('account', $account);

        return $query->getResult();
    }

    public function save(SchedulerForm $schedulerForm)
    {
        $amount = $schedulerForm->getElement('amount')->getValue();
        $debitCredit = $schedulerForm->getElement('debitCredit')->getValue();

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
                $schedulerForm->getElement('accountId')->getValue()
            ),
            'category' => $this->_em->find(
                'Application\\Models\\Category',
                $schedulerForm->getElement('categoryId')->getValue()
            ),
            'paymentMethod' => $this->_em->find(
                'Application\\Models\\PaymentMethod',
                $schedulerForm->getElement('paymentMethodId')->getValue()
            ),
            'transferAccount' => $this->_em->find(
                'Application\\Models\\Account',
                $schedulerForm->getElement('transferAccountId')->getValue()
            ),
            'debit' => $debit,
            'credit' => $credit,
        );

        if (
            null !== $values['paymentMethod']
            && !in_array($values['paymentMethod']->getPaymentMethodId(), array(4, 6))
        ) {
            $values['transferAccount'] = null;
        }

        if ('' != $schedulerForm->getElement('schedulerId')->getValue()) {
            return parent::update($schedulerForm, $values);
        } else {
            return parent::add($schedulerForm, $values);
        }
    }

    public function delete(array $schedulersId)
    {
        foreach ($schedulersId as $schedulerId) {
            $scheduler = $this->_em->find(
                'Application\\Models\\Scheduler',
                $schedulerId
            );

            if (null !== $scheduler) {
                parent::delete($scheduler);
            }
        }
    }
}
