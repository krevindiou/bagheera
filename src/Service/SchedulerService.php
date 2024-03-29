<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\PaymentMethod;
use App\Entity\Scheduler;
use App\Form\Model\SchedulerFormModel;
use App\Form\Type\SchedulerFormType;
use App\Repository\OperationRepository;
use App\Repository\SchedulerRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Pagerfanta\Pagerfanta;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;

class SchedulerService
{
    public function __construct(private LoggerInterface $logger, private EntityManagerInterface $entityManager, private FormFactoryInterface $formFactory, private OperationService $operationService, private OperationRepository $operationRepository, private SchedulerRepository $schedulerRepository)
    {
    }

    /**
     * Returns schedulers list.
     */
    public function getList(Account $account, int $currentPage = 1): Pagerfanta
    {
        return $this->schedulerRepository->getList($account, $currentPage);
    }

    /**
     * Returns scheduler form.
     */
    public function getForm(Scheduler $scheduler = null, Account $account = null): ?FormInterface
    {
        $formModel = new SchedulerFormModel();

        if (null === $scheduler && null !== $account) {
            $formModel->account = $account;
        } elseif (null !== $scheduler) {
            $formModel->schedulerId = $scheduler->getSchedulerId();
            $formModel->account = $scheduler->getAccount();
            $formModel->type = null !== $scheduler->getCredit() ? 'credit' : 'debit';
            $formModel->thirdParty = $scheduler->getThirdParty();
            $formModel->category = $scheduler->getCategory();
            $formModel->paymentMethod = $scheduler->getPaymentMethod();
            $formModel->valueDate = $scheduler->getValueDate();
            $formModel->notes = $scheduler->getNotes();
            $formModel->reconciled = $scheduler->isReconciled();
            $formModel->active = $scheduler->isActive();
            $formModel->amount = null !== $scheduler->getCredit() ? $scheduler->getCredit() : $scheduler->getDebit();
            $formModel->limitDate = $scheduler->getLimitDate();
            $formModel->frequencyUnit = $scheduler->getFrequencyUnit();
            $formModel->frequencyValue = $scheduler->getFrequencyValue();
            $formModel->transferAccount = $scheduler->getTransferAccount();
        }

        return $this->formFactory->create(SchedulerFormType::class, $formModel, ['account' => $formModel->account]);
    }

    /**
     * Saves scheduler form.
     */
    public function saveForm(?Scheduler $scheduler, FormInterface $form): bool
    {
        if ($form->isValid()) {
            $formModel = $form->getData();

            if (null === $scheduler) {
                $scheduler = new Scheduler();
            }

            $scheduler->setSchedulerId($formModel->schedulerId);
            $scheduler->setAccount($formModel->account);
            $scheduler->setThirdParty($formModel->thirdParty);
            $scheduler->setCategory($formModel->category);
            $scheduler->setPaymentMethod($formModel->paymentMethod);
            $scheduler->setValueDate($formModel->valueDate);
            $scheduler->setNotes($formModel->notes ?? '');
            $scheduler->setReconciled($formModel->reconciled);
            $scheduler->setActive($formModel->active);
            $scheduler->setDebit('debit' === $formModel->type ? $formModel->amount : null);
            $scheduler->setCredit('credit' === $formModel->type ? $formModel->amount : null);
            $scheduler->setLimitDate($formModel->limitDate);
            $scheduler->setFrequencyUnit($formModel->frequencyUnit);
            $scheduler->setFrequencyValue($formModel->frequencyValue);
            $scheduler->setTransferAccount($formModel->transferAccount);

            return $this->doSave($scheduler);
        }

        return false;
    }

    /**
     * Deletes scheduler.
     */
    public function delete(Scheduler $scheduler): bool
    {
        try {
            $this->entityManager->remove($scheduler);
            $this->entityManager->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());

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

            $result = $this->operationRepository->getLastScheduledOperationDate($scheduler);
            if (isset($result[0]['valueDate'])) {
                $startDate = $result[0]['valueDate']->add($periodInterval);
            }

            $periodIterator = new \DatePeriod($startDate, $periodInterval, $endDate);
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
                $operation->setNotes($scheduler->getNotes() ?? '');
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
            $this->entityManager->persist($scheduler);
            $this->entityManager->flush();

            $this->runSchedulers($scheduler->getAccount()->getBank()->getMember());

            return true;
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());
        }

        return false;
    }
}
