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
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\Validator\Validator,
    Symfony\Bridge\Monolog\Logger,
    Pagerfanta\Pagerfanta,
    Pagerfanta\Adapter\DoctrineCollectionAdapter,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\Operation,
    Krevindiou\BagheeraBundle\Entity\Scheduler,
    Krevindiou\BagheeraBundle\Entity\PaymentMethod,
    Krevindiou\BagheeraBundle\Form\SchedulerForm;

/**
 * Scheduler service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerService
{
    /**
     * @var Logger
     */
    protected $_logger;

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

    /**
     * @var OperationService
     */
    protected $_operationService;

    public function __construct(
        Logger $logger,
        EntityManager $em,
        FormFactory $formFactory,
        Validator $validator,
        OperationService $operationService)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_operationService = $operationService;
    }

    /**
     * Returns schedulers list
     *
     * @param  User       $user        User entity
     * @param  Account    $account     Account entity
     * @param  integer    $currentPage Page number
     * @return Pagerfanta
     */
    public function getList(User $user, Account $account, $currentPage = 1)
    {
        if ($account->getBank()->getUser() == $user) {
            $adapter = new DoctrineCollectionAdapter($account->getSchedulers());

            $pager = new Pagerfanta($adapter);
            $pager->setMaxPerPage(20);
            $pager->setCurrentPage($currentPage);

            return $pager;
        }
    }

    /**
     * Returns scheduler form
     *
     * @param  User      $user      User entity
     * @param  Scheduler $scheduler Scheduler entity
     * @param  Account   $account   Account entity for new scheduler
     * @return Form
     */
    public function getForm(User $user, Scheduler $scheduler = null, Account $account = null)
    {
        if (null === $scheduler && null !== $account) {
            $scheduler = new Scheduler();
            $scheduler->setAccount($account);
        } elseif (null !== $scheduler && $user !== $scheduler->getAccount()->getBank()->getUser()) {
            return;
        }

        return $this->_formFactory->create(new SchedulerForm(), $scheduler);
    }

    /**
     * Saves scheduler
     *
     * @param  User      $user      User entity
     * @param  Scheduler $scheduler Scheduler entity
     * @return boolean
     */
    protected function _save(User $user, Scheduler $scheduler)
    {
        if (null !== $scheduler->getSchedulerId()) {
            $oldScheduler = $this->_em->getUnitOfWork()->getOriginalEntityData($scheduler);

            if ($user !== $oldScheduler['account']->getBank()->getUser()) {
                return false;
            }
        }

        if ($user === $scheduler->getAccount()->getBank()->getUser()) {
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

                $this->runSchedulers($user);

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Saves scheduler
     *
     * @param  User      $user      User entity
     * @param  Scheduler $scheduler Scheduler entity
     * @return boolean
     */
    public function save(User $user, Scheduler $scheduler)
    {
        $errors = $this->_validator->validate($scheduler);

        if (0 == count($errors)) {
            return $this->_save($user, $scheduler);
        }

        return false;
    }

    /**
     * Saves scheduler form
     *
     * @param  User    $user User entity
     * @param  Form    $form Scheduler form
     * @return boolean
     */
    public function saveForm(User $user, Form $form)
    {
        if ($form->isValid()) {
            return $this->_save($user, $form->getData());
        }

        return false;
    }

    /**
     * Deletes schedulers
     *
     * @param  User    $user         User entity
     * @param  array   $schedulersId Schedulers id to delete
     * @return boolean
     */
    public function delete(User $user, array $schedulersId)
    {
        try {
            foreach ($schedulersId as $schedulerId) {
                $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', $schedulerId);

                if (null !== $scheduler) {
                    if ($user === $scheduler->getAccount()->getBank()->getUser()) {
                        $this->_em->remove($scheduler);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Executes schedulers for specified user
     *
     * @param  User     $user User entity
     * @param  DateTime $now  DateTime object
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
                $startDate = $lastOperationDate = $result[0]['valueDate'];
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
                $operation->setTransferAccount($scheduler->getTransferAccount());

                $this->_operationService->save($user, $operation);
            }
        }
    }
}
