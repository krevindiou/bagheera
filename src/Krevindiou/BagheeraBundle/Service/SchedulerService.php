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
    Symfony\Component\Form\FormFactory,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\Operation,
    Krevindiou\BagheeraBundle\Entity\Scheduler,
    Krevindiou\BagheeraBundle\Entity\PaymentMethod,
    Krevindiou\BagheeraBundle\Form\SchedulerForm,
    Krevindiou\BagheeraBundle\Service\OperationService;

/**
 * Scheduler service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerService
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
     * @var OperationService
     */
    protected $_operationService;


    public function __construct(EntityManager $em, FormFactory $formFactory, OperationService $operationService)
    {
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_operationService = $operationService;
    }

    /**
     * Returns scheduler form
     *
     * @param  Scheduler $scheduler Scheduler entity
     * @param  array $values        Post data
     * @return Form
     */
    public function getForm(Scheduler $scheduler, array $values = null)
    {
        $form = $this->_formFactory->create(new SchedulerForm(), $scheduler);
        if (null !== $values) {
            $form->bind($values);
        }

        return $form;
    }

    /**
     * Saves scheduler
     *
     * @param  Scheduler $scheduler Scheduler entity
     * @param  string $debitCredit  'debit' or 'credit'
     * @param  float $amount        Scheduler amount
     * @return boolean
     */
    public function save(Scheduler $scheduler, $debitCredit = null, $amount = null)
    {
        if (null !== $debitCredit && null !== $amount) {
            if ('debit' == $debitCredit) {
                $scheduler->setDebit($amount);
                $scheduler->setCredit(null);
            } else {
                $scheduler->setDebit(null);
                $scheduler->setCredit($amount);
            }
        }

        if (!in_array(
            $scheduler->getPaymentMethod()->getPaymentMethodId(),
            array(
                PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER,
                PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
            )
        )) {
            $scheduler->setTransferAccount(null);
        }

        try {
            $this->_em->persist($scheduler);
            $this->_em->flush();

            return true;
        } catch (\Exception $e) {
            return false;
        }

        return false;
    }

    /**
     * Deletes schedulers
     *
     * @param  array $schedulersId Schedulers id to delete
     * @return boolean
     */
    public function delete(array $schedulersId)
    {
        foreach ($schedulersId as $schedulerId) {
            $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', $schedulerId);

            if (null !== $scheduler) {
                try {
                    $this->_em->remove($scheduler);
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
     * Gets schedulers list
     *
     * @param  Account $account Account entity
     * @param  integer $page    Page number
     * @return array
     */
    public function getSchedulers(Account $account, $page = 1)
    {
        $dql = 'SELECT s ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Scheduler s ';
        $dql.= 'WHERE s.account = :account ';
        $dql.= 'ORDER BY s.valueDate DESC ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('account', $account);

        return $query->getResult();
    }

    /**
     * Executes schedulers for specified user
     *
     * @param  User $user       User entity
     * @param  DateTime $now    DateTime object
     * @return boolean
     */
    public function runSchedulers(User $user, \DateTime $now = null)
    {
        if (null === $now) {
            $now = new \DateTime();
        }

        $schedulers = new ArrayCollection();

        $banks = $user->getBanks();
        foreach ($banks as $bank) {
            $accounts = $bank->getAccounts();
            foreach ($accounts as $account) {
                foreach ($account->getSchedulers() as $scheduler) {
                    if ($scheduler->getIsActive()) {
                        $schedulers->add($scheduler);
                    }
                }
            }
        }

        foreach ($schedulers as $scheduler) {
            $startDate = $scheduler->getValueDate();

            $dql = 'SELECT o.valueDate ';
            $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
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

            $endDate = $now;
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

                $this->_operationService->save(
                    $operation,
                    null,
                    null,
                    $scheduler->getTransferAccount()
                );
            }
        }
    }
}
