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
    Application\Models\Transaction as TransactionModel,
    Application\Forms\Scheduler as SchedulerForm,
    Application\Forms\Transaction as TransactionForm,
    Application\Services\User as UserService,
    Application\Services\Transaction as TransactionService,
    Application\Services\Scheduler as SchedulerService;

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
    public function getForm(SchedulerModel $scheduler = null, array $extraValues = null)
    {
        if (null === $scheduler) {
            $scheduler = new SchedulerModel();
        }

        if ('' == $scheduler->getValueDate()) {
            $scheduler->setValueDate(new \DateTime);
        }

        $account = $scheduler->getAccount();
        $category = $scheduler->getCategory();
        $paymentMethod = $scheduler->getPaymentMethod();
        $transferAccount = $scheduler->getTransferAccount();
        $debit = $scheduler->getDebit();
        $credit = $scheduler->getCredit();

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
            $extraValues['debitCredit'] = ($debit > 0) ? 'debit' : 'credit';
        }
        if (!isset($extraValues['isReconciled'])) {
            $extraValues['isReconciled'] = (int)$scheduler->getIsReconciled();
        }

        return parent::getForm(new SchedulerForm(), $scheduler, $extraValues);
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
            $ok = parent::add($schedulerForm, $values);

            if ($ok) {
                $schedulerService = SchedulerService::getInstance();
                $schedulerService->runSchedulers();
            }

            return $ok;
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

    public function runSchedulers()
    {
        $userService = UserService::getInstance();
        $currentUser = $userService->getCurrentUser();

        $accounts = $currentUser->getAccounts();

        $schedulers = new \Doctrine\Common\Collections\ArrayCollection();
        foreach ($accounts as $account) {
            foreach ($account->getSchedulers() as $scheduler) {
                if ($scheduler->getIsActive()) {
                    $schedulers->add($scheduler);
                }
            }
        }

        foreach ($schedulers as $scheduler) {
            $startDate = $scheduler->getValueDate();

            $dql = 'SELECT t._valueDate ';
            $dql.= 'FROM Application\\Models\\Transaction t ';
            $dql.= 'WHERE t._scheduler = :scheduler ';
            $dql.= 'AND t._valueDate >= :valueDate ';
            $dql.= 'ORDER BY t._valueDate DESC ';
            $q = $this->_em->createQuery($dql);
            $q->setMaxResults(1);
            $q->setParameter('scheduler', $scheduler);
            $q->setParameter('valueDate', $scheduler->getValueDate()->format(\DateTime::ISO8601));
            $result = $q->getResult();

            $lastTransactionDate = null;
            if (isset($result[0]['_valueDate'])) {
                $startDate = $lastTransactionDate = new \DateTime($result[0]['_valueDate']);
            }

            $endDate = new \DateTime();
            if ($scheduler->getLimitDate() != null && $scheduler->getLimitDate() < $endDate) {
                $endDate = $scheduler->getLimitDate();
            }

            $dates = array();
            $date = clone $startDate;

            while ($date <= $endDate) {
                if ($date != $startDate || null === $lastTransactionDate) {
                    $dates[] = $date->format(\DateTime::ISO8601);
                }

                $date->add(
                    new \DateInterval(
                        sprintf(
                            'P%d%s',
                            $scheduler->getFrequencyValue(),
                            substr(strtoupper($scheduler->getFrequencyUnit()), 0, 1)
                        )
                    )
                );
            }

            foreach ($dates as $date) {
                $transactionService = TransactionService::getInstance();

                $transaction = new TransactionModel();
                $transaction->setScheduler($scheduler);
                $transaction->setAccount($scheduler->getAccount());
                $transaction->setCategory($scheduler->getCategory());
                $transaction->setThirdParty($scheduler->getThirdParty());
                $transaction->setPaymentMethod($scheduler->getPaymentMethod());
                $transaction->setDebit($scheduler->getDebit());
                $transaction->setCredit($scheduler->getCredit());
                $transaction->setValueDate(new \DateTime($date));
                $transaction->setIsReconciled($scheduler->getIsReconciled());
                $transaction->setNotes($scheduler->getNotes());

                $values = array();
                if (null !== $scheduler->getTransferAccount()) {
                    $values['transferAccountId'] = $scheduler->getTransferAccount()->getAccountId();
                }

                $transactionForm = $transactionService->getForm($transaction, $values);
                $transactionService->save($transactionForm);
            }
        }
    }
}
