<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\PaymentMethod;
use App\Entity\Scheduler;
use App\Form\Type\SchedulerFormType;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Pagerfanta\Pagerfanta;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class SchedulerService
{
    private $logger;
    private $em;
    private $formFactory;
    private $validator;
    private $operationService;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        OperationService $operationService
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->operationService = $operationService;
    }

    /**
     * Returns schedulers list.
     */
    public function getList(Account $account, int $currentPage = 1): Pagerfanta
    {
        return $this->em->getRepository('App:Scheduler')->getList($account, $currentPage);
    }

    /**
     * Returns scheduler form.
     *
     * @param Scheduler $scheduler Scheduler entity
     * @param Account   $account   Account entity for new scheduler
     */
    public function getForm(Scheduler $scheduler = null, Account $account = null): ?Form
    {
        if (null === $scheduler) {
            if (null !== $account) {
                $scheduler = new Scheduler();
                $scheduler->setAccount($account);
            } else {
                return null;
            }
        }

        return $this->formFactory->create(SchedulerFormType::class, $scheduler);
    }

    /**
     * Saves scheduler.
     */
    public function save(Scheduler $scheduler): bool
    {
        $errors = $this->validator->validate($scheduler);

        if (0 === count($errors)) {
            return $this->doSave($scheduler);
        }

        return false;
    }

    /**
     * Saves scheduler form.
     */
    public function saveForm(Form $form): bool
    {
        if ($form->isValid()) {
            return $this->doSave($form->getData());
        }

        return false;
    }

    /**
     * Deletes scheduler.
     */
    public function delete(Scheduler $scheduler): bool
    {
        try {
            $this->em->remove($scheduler);
            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Executes schedulers for specified member.
     */
    public function runSchedulers(Member $member, \DateTime $now = null): void
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
            $result = $this->em->getRepository('App:Operation')->getLastScheduledOperationDate($scheduler);

            $lastOperationDate = null;
            if (isset($result[0]['valueDate'])) {
                $startDate = $lastOperationDate = $result[0]['valueDate'];
            }

            $endDate = $now;
            if (null !== $scheduler->getLimitDate() && $scheduler->getLimitDate() < $endDate) {
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
                $operation->setNotes((string) $scheduler->getNotes());
                $operation->setTransferAccount($scheduler->getTransferAccount());

                $this->operationService->save($member, $operation);
            }
        }
    }

    /**
     * Saves scheduler.
     */
    protected function doSave(Scheduler $scheduler): bool
    {
        if (!in_array(
            $scheduler->getPaymentMethod()->getPaymentMethodId(),
            [
                PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER,
                PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER,
            ],
            true
        )) {
            $scheduler->setTransferAccount(null);
        }

        try {
            $this->em->persist($scheduler);
            $this->em->flush();

            $this->runSchedulers($scheduler->getAccount()->getBank()->getMember());

            return true;
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }
    }
}
