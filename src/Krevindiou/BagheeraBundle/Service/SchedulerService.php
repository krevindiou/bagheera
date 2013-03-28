<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\Validator\Validator;
use Symfony\Bridge\Monolog\Logger;
use Pagerfanta\Pagerfanta;
use Pagerfanta\Adapter\DoctrineCollectionAdapter;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\User;
use Krevindiou\BagheeraBundle\Entity\Account;
use Krevindiou\BagheeraBundle\Entity\Operation;
use Krevindiou\BagheeraBundle\Entity\Scheduler;
use Krevindiou\BagheeraBundle\Entity\PaymentMethod;

/**
 * Scheduler service
 *
 *
 * @DI\Service("bagheera.scheduler")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "scheduler"})
 */
class SchedulerService
{
    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /** @DI\Inject */
    public $validator;

    /** @DI\Inject("bagheera.operation") */
    public $operationService;

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

        return $this->formFactory->create('scheduler_type', $scheduler);
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
            $oldScheduler = $this->em->getUnitOfWork()->getOriginalEntityData($scheduler);

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
                $this->em->persist($scheduler);
                $this->em->flush();

                $this->runSchedulers($user);

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
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
        $errors = $this->validator->validate($scheduler);

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
                $scheduler = $this->em->find('KrevindiouBagheeraBundle:Scheduler', $schedulerId);

                if (null !== $scheduler) {
                    if ($user === $scheduler->getAccount()->getBank()->getUser()) {
                        $this->em->remove($scheduler);
                    }
                }
            }

            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());

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
            $q = $this->em->createQuery($dql);
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

                $this->operationService->save($user, $operation);
            }
        }
    }
}
