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
    Doctrine\Common\Collections\ArrayCollection,
    Symfony\Component\Security\Core\SecurityContext,
    Krevindiou\BagheeraBundle\Entity\Scheduler,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\Operation,
    Application\Forms\Scheduler as SchedulerForm,
    Application\Forms\Operation as OperationForm,
    Krevindiou\BagheeraBundle\Service\UserService,
    Krevindiou\BagheeraBundle\Service\OperationService,
    Krevindiou\BagheeraBundle\Service\SchedulerService,
    Krevindiou\BagheeraBundle\Service\UserService,
    Krevindiou\BagheeraBundle\Service\OperationService;

/**
 * Scheduler service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerService extends CrudAbstract
{
    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var SecurityContext
     */
    protected $_context;

    /**
     * @var UserService
     */
    protected $_userService;

    /**
     * @var OperationService
     */
    protected $_operationService;


    public function __construct(EntityManager $em, SecurityContext $context, UserService $userService, OperationService $operationService)
    {
        $this->_em = $em;
        $this->_context = $context;
        $this->_userService = $userService;
        $this->_operationService = $operationService;
    }

    public function getForm(Scheduler $scheduler = null, array $extraValues = null)
    {
        if (null === $scheduler) {
            $scheduler = new Scheduler();
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

    public function getSchedulers(Account $account)
    {
        $dql = 'SELECT s ';
        $dql.= 'FROM Scheduler s ';
        $dql.= 'WHERE s.account = :account ';
        $dql.= 'ORDER BY s.valueDate DESC ';
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
                'Account',
                $schedulerForm->getElement('accountId')->getValue()
            ),
            'category' => $this->_em->find(
                'Category',
                $schedulerForm->getElement('categoryId')->getValue()
            ),
            'paymentMethod' => $this->_em->find(
                'PaymentMethod',
                $schedulerForm->getElement('paymentMethodId')->getValue()
            ),
            'transferAccount' => $this->_em->find(
                'Account',
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
                $this->_schedulerService->runSchedulers();
            }

            return $ok;
        }
    }

    public function delete(array $schedulersId)
    {
        foreach ($schedulersId as $schedulerId) {
            $scheduler = $this->_em->find('Scheduler', $schedulerId);

            if (null !== $scheduler) {
                parent::delete($scheduler);
            }
        }
    }

    public function runSchedulers()
    {
        $currentUser = $this->_context->getUser();

        $accounts = $currentUser->getAccounts();

        $schedulers = new ArrayCollection();
        foreach ($accounts as $account) {
            foreach ($account->getSchedulers() as $scheduler) {
                if ($scheduler->getIsActive()) {
                    $schedulers->add($scheduler);
                }
            }
        }

        foreach ($schedulers as $scheduler) {
            $startDate = $scheduler->getValueDate();

            $dql = 'SELECT o.valueDate ';
            $dql.= 'FROM Operation o ';
            $dql.= 'WHERE o.scheduler = :scheduler ';
            $dql.= 'AND o.valueDate >= :valueDate ';
            $dql.= 'ORDER BY o.valueDate DESC ';
            $q = $this->_em->createQuery($dql);
            $q->setMaxResults(1);
            $q->setParameter('scheduler', $scheduler);
            $q->setParameter('valueDate', $scheduler->getValueDate()->format(\DateTime::ISO8601));
            $result = $q->getResult();

            $lastOperationDate = null;
            if (isset($result[0]['valueDate'])) {
                $startDate = $lastOperationDate = new \DateTime($result[0]['valueDate']);
            }

            $endDate = new \DateTime();
            if ($scheduler->getLimitDate() != null && $scheduler->getLimitDate() < $endDate) {
                $endDate = $scheduler->getLimitDate();
            }

            $dates = array();
            $date = clone $startDate;

            while ($date <= $endDate) {
                if ($date != $startDate || null === $lastOperationDate) {
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
                $operationService = OperationService::getInstance();

                $operation = new Operation();
                $operation->setScheduler($scheduler);
                $operation->setAccount($scheduler->getAccount());
                $operation->setCategory($scheduler->getCategory());
                $operation->setThirdParty($scheduler->getThirdParty());
                $operation->setPaymentMethod($scheduler->getPaymentMethod());
                $operation->setDebit($scheduler->getDebit());
                $operation->setCredit($scheduler->getCredit());
                $operation->setValueDate(new \DateTime($date));
                $operation->setIsReconciled($scheduler->getIsReconciled());
                $operation->setNotes($scheduler->getNotes());

                $values = array();
                if (null !== $scheduler->getTransferAccount()) {
                    $values['transferAccountId'] = $scheduler->getTransferAccount()->getAccountId();
                }

                $operationForm = $operationService->getForm($operation, $values);
                $operationService->save($operationForm);
            }
        }
    }
}
