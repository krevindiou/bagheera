<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Service;

use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Component\Form\Form;
use Pagerfanta\Pagerfanta;
use Pagerfanta\Adapter\CallbackAdapter;
use JMS\DiExtraBundle\Annotation as DI;
use AppBundle\Entity\Member;
use AppBundle\Entity\Account;
use AppBundle\Entity\Operation;
use AppBundle\Entity\Scheduler;
use AppBundle\Entity\PaymentMethod;

/**
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
     * @param  Member     $member      Member entity
     * @param  Account    $account     Account entity
     * @param  integer    $currentPage Page number
     * @return Pagerfanta
     */
    public function getList(Member $member, Account $account, $currentPage = 1)
    {
        if ($account->getBank()->getMember() == $member) {
            $params = [
                ':account_id' => $account->getAccountId()
            ];

            $sql = 'SELECT
                scheduler.scheduler_id AS scheduler_id,
                scheduler.third_party AS scheduler_third_party,
                scheduler.debit AS scheduler_debit,
                scheduler.credit AS scheduler_credit,
                scheduler.value_date AS scheduler_value_date,
                scheduler.limit_date AS scheduler_limit_date,
                scheduler.is_reconciled AS scheduler_is_reconciled,
                scheduler.notes AS scheduler_notes,
                scheduler.frequency_unit AS scheduler_frequency_unit,
                scheduler.frequency_value AS scheduler_frequency_value,
                scheduler.is_active AS scheduler_is_active,
                account.account_id AS account_id,
                account.name AS account_name,
                account.currency AS account_currency,
                transfer_account.account_id AS transfer_account_id,
                transfer_account.name AS transfer_account_name,
                category.category_id AS category_id,
                category.name AS category_name,
                payment_method.payment_method_id AS payment_method_id,
                payment_method.name AS payment_method_name
                ';
            $sql.= 'FROM scheduler ';
            $sql.= 'INNER JOIN account ON scheduler.account_id = account.account_id ';
            $sql.= 'LEFT JOIN account AS transfer_account ON scheduler.transfer_account_id = transfer_account.account_id ';
            $sql.= 'LEFT JOIN category ON scheduler.category_id = category.category_id ';
            $sql.= 'LEFT JOIN payment_method ON scheduler.payment_method_id = payment_method.payment_method_id ';
            $sql.= 'WHERE scheduler.account_id = :account_id ';
            $sql.= 'ORDER BY scheduler.created_at DESC ';

            $conn = $this->em->getConnection();

            $getNbResultsCallback = function () use ($sql, $conn, $params) {
                $start = strpos($sql, ' FROM ');
                $length = strpos($sql, ' ORDER BY ') - $start;

                $sqlCount = 'SELECT COUNT(*) AS total ';
                $sqlCount.= substr($sql, $start, $length);

                $stmt = $conn->prepare($sqlCount);
                $stmt->execute($params);

                return $stmt->fetchColumn();
            };

            $getSliceCallback = function ($offset, $length) use ($sql, $conn, $params) {
                $sql.= 'LIMIT :length OFFSET :offset';

                $params[':length'] = $length;
                $params[':offset'] = $offset;

                $stmt = $conn->prepare($sql);
                $stmt->execute($params);

                $schedulers = [];

                foreach ($stmt->fetchAll() as $row) {
                    if (!isset($schedulers[$row['scheduler_id']])) {
                        $schedulers[$row['scheduler_id']] = [
                            'schedulerId' => $row['scheduler_id'],
                            'account' => [
                                'accountId' => $row['account_id'],
                                'currency' => $row['account_currency'],
                                'name' => $row['account_name'],
                            ],
                            'transferAccount' => [
                                'accountId' => $row['transfer_account_id'],
                                'name' => $row['transfer_account_name'],
                            ],
                            'category' => [
                                'categoryId' => $row['category_id'],
                                'name' => $row['category_name'],
                            ],
                            'paymentMethod' => [
                                'paymentMethodId' => $row['payment_method_id'],
                                'name' => $row['payment_method_name'],
                            ],

                            'thirdParty' => $row['scheduler_third_party'],
                            'debit' => $row['scheduler_debit'],
                            'credit' => $row['scheduler_credit'],
                            'amount' => (0 != $row['scheduler_credit']) ? $row['scheduler_credit'] : -$row['scheduler_debit'],
                            'valueDate' => (null !== $row['scheduler_value_date']) ? new \DateTime($row['scheduler_value_date']) : null,
                            'limitDate' => (null !== $row['scheduler_limit_date']) ? new \DateTime($row['scheduler_limit_date']) : null,
                            'reconciled' => $row['scheduler_is_reconciled'],
                            'notes' => $row['scheduler_notes'],
                            'frequencyUnit' => $row['scheduler_frequency_unit'],
                            'frequencyValue' => $row['scheduler_frequency_value'],
                            'active' => $row['scheduler_is_active'],
                        ];
                    }
                }

                return $schedulers;
            };

            $adapter = new CallbackAdapter($getNbResultsCallback, $getSliceCallback);

            $pager = new Pagerfanta($adapter);
            $pager->setMaxPerPage(20);
            $pager->setCurrentPage($currentPage);

            return $pager;
        }
    }

    /**
     * Returns scheduler form
     *
     * @param  Member    $member    Member entity
     * @param  Scheduler $scheduler Scheduler entity
     * @param  Account   $account   Account entity for new scheduler
     * @return Form
     */
    public function getForm(Member $member, Scheduler $scheduler = null, Account $account = null)
    {
        if (null === $scheduler && null !== $account) {
            $scheduler = new Scheduler();
            $scheduler->setAccount($account);
        } elseif (null !== $scheduler && $member !== $scheduler->getAccount()->getBank()->getMember()) {
            return;
        }

        return $this->formFactory->create('scheduler', $scheduler);
    }

    /**
     * Saves scheduler
     *
     * @param  Member    $member    Member entity
     * @param  Scheduler $scheduler Scheduler entity
     * @return boolean
     */
    protected function doSave(Member $member, Scheduler $scheduler)
    {
        if (null !== $scheduler->getSchedulerId()) {
            $oldScheduler = $this->em->getUnitOfWork()->getOriginalEntityData($scheduler);

            if ($member !== $oldScheduler['account']->getBank()->getMember()) {
                return false;
            }
        }

        if ($member === $scheduler->getAccount()->getBank()->getMember()) {
            if (!in_array(
                $scheduler->getPaymentMethod()->getPaymentMethodId(),
                [
                    PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER,
                    PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                ]
            )) {
                $scheduler->setTransferAccount(null);
            }

            try {
                $this->em->persist($scheduler);
                $this->em->flush();

                $this->runSchedulers($member);

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
     * @param  Member    $member    Member entity
     * @param  Scheduler $scheduler Scheduler entity
     * @return boolean
     */
    public function save(Member $member, Scheduler $scheduler)
    {
        $errors = $this->validator->validate($scheduler);

        if (0 == count($errors)) {
            return $this->doSave($member, $scheduler);
        }

        return false;
    }

    /**
     * Saves scheduler form
     *
     * @param  Member  $member Member entity
     * @param  Form    $form   Scheduler form
     * @return boolean
     */
    public function saveForm(Member $member, Form $form)
    {
        if ($form->isValid()) {
            return $this->doSave($member, $form->getData());
        }

        return false;
    }

    /**
     * Deletes schedulers
     *
     * @param  Member  $member       Member entity
     * @param  array   $schedulersId Schedulers id to delete
     * @return boolean
     */
    public function delete(Member $member, array $schedulersId)
    {
        try {
            foreach ($schedulersId as $schedulerId) {
                $scheduler = $this->em->find('Model:Scheduler', $schedulerId);

                if (null !== $scheduler) {
                    if ($member === $scheduler->getAccount()->getBank()->getMember()) {
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
     * Executes schedulers for specified member
     *
     * @param  Member   $member Member entity
     * @param  DateTime $now    DateTime object
     * @return boolean
     */
    public function runSchedulers(Member $member, \DateTime $now = null)
    {
        if (null === $now) {
            $now = new \DateTime();
        }

        $schedulers = new ArrayCollection();

        $banks = $member->getBanks();
        foreach ($banks as $bank) {
            $accounts = $bank->getAccounts();
            foreach ($accounts as $account) {
                foreach ($account->getSchedulers() as $scheduler) {
                    if ($scheduler->isActive()) {
                        $schedulers->add($scheduler);
                    }
                }
            }
        }

        foreach ($schedulers as $scheduler) {
            $startDate = $scheduler->getValueDate();

            $dql = 'SELECT o.valueDate ';
            $dql.= 'FROM Model:Operation o ';
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

            $periodInterval = new \DateInterval(
                sprintf(
                    'P%d%s',
                    $scheduler->getFrequencyValue(),
                    substr(strtoupper($scheduler->getFrequencyUnit()), 0, 1)
                )
            );

            $periodIterator = new \DatePeriod($startDate, $periodInterval, $endDate, \DatePeriod::EXCLUDE_START_DATE);

            foreach ($periodIterator as $date) {
                $operation = new Operation();
                $operation->setScheduler($scheduler);
                $operation->setAccount($scheduler->getAccount());
                $operation->setCategory($scheduler->getCategory());
                $operation->setThirdParty($scheduler->getThirdParty());
                $operation->setPaymentMethod($scheduler->getPaymentMethod());
                $operation->setDebit($scheduler->getDebit());
                $operation->setCredit($scheduler->getCredit());
                $operation->setValueDate($date);
                $operation->setReconciled($scheduler->isReconciled());
                $operation->setNotes($scheduler->getNotes());
                $operation->setTransferAccount($scheduler->getTransferAccount());

                $this->operationService->save($member, $operation);
            }
        }
    }
}
