<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Bank;
use App\Entity\Member;
use App\Form\Model\BankChooseFormModel;
use App\Form\Model\BankUpdateFormModel;
use App\Form\Type\BankChooseFormType;
use App\Form\Type\BankUpdateFormType;
use App\Repository\BankRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Process\PhpExecutableFinder;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class BankService
{
    private $logger;
    private $em;
    private $formFactory;
    private $validator;
    private $accountService;
    private $bankRepository;
    private $projectDir;
    private $environment;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        AccountService $accountService,
        BankRepository $bankRepository,
        $projectDir,
        $environment
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->accountService = $accountService;
        $this->bankRepository = $bankRepository;
        $this->projectDir = $projectDir;
        $this->environment = $environment;
    }

    /**
     * Returns banks list.
     */
    public function getList(Member $member, bool $activeOnly = true): ArrayCollection
    {
        return $this->bankRepository->getList($member, $activeOnly);
    }

    /**
     * Returns bank form.
     */
    public function getForm(Member $member, Bank $bank = null): ?Form
    {
        if (null === $bank) {
            $formModel = new BankChooseFormModel();

            return $this->formFactory->create(BankChooseFormType::class, $formModel, ['member' => $member]);
        }
        if ($member === $bank->getMember()) {
            $formModel = new BankUpdateFormModel();
            $formModel->name = $bank->getName();

            return $this->formFactory->create(
                BankUpdateFormType::class,
                $formModel,
                [
                    'hasProvider' => null !== $bank->getProvider(),
                    'bankId' => $bank->getBankId(),
                ]
            );
        }

        return null;
    }

    /**
     * Saves bank form.
     */
    public function saveForm(Member $member, ?Bank $bank, $formModel)
    {
        $errors = $this->validator->validate($formModel);
        if (0 !== count($errors)) {
            return false;
        }

        if ($formModel instanceof BankChooseFormModel) {
            $bank = new Bank();
            $bank->setMember($member);

            if (null !== $formModel->provider) {
                $bank->setProvider($formModel->provider);
                $bank->setName($formModel->provider->getName());
            } elseif (null === $formModel->bank) {
                $bank->setName($formModel->other);
            }
        } else {
            $bank->setName($formModel->name);
        }

        $this->doSave($member, $bank);

        return $bank;
    }

    /**
     * Closes banks.
     */
    public function close(Member $member, array $banksId): bool
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->em->find(Bank::class, $bankId);

                if (null !== $bank) {
                    if ($member === $bank->getMember()) {
                        $bank->setClosed(true);
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
     * Deletes banks.
     */
    public function delete(Member $member, array $banksId): bool
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->em->find(Bank::class, $bankId);

                if (null !== $bank) {
                    if ($member === $bank->getMember()) {
                        $bank->setDeleted(true);
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
     * Gets bank balances.
     */
    public function getBalances(Member $member, Bank $bank): array
    {
        $balances = [];

        if ($member === $bank->getMember()) {
            $accounts = $bank->getAccounts();
            foreach ($accounts as $account) {
                if (!$account->isDeleted()) {
                    $accountBalance = $this->accountService->getBalance($member, $account);

                    if (isset($balances[$account->getCurrency()])) {
                        $balances[$account->getCurrency()] += $accountBalance;
                    } else {
                        $balances[$account->getCurrency()] = $accountBalance;
                    }
                }
            }
        }

        return $balances;
    }

    /**
     * Retrieves external bank data.
     */
    public function importExternalBank(Bank $bank): void
    {
        if (null !== $bank->getProvider()) {
            $executableFinder = new PhpExecutableFinder();

            $phpBin = $executableFinder->find();
            if (false === $phpBin) {
                $this->logger->err('Unable to find php binary');

                return;
            }

            $cmd = sprintf(
                '%s > /dev/null 2>&1 & echo $!',
                sprintf(
                    '%s %s/bin/console --env=%s bagheera:import_external_bank %d',
                    $phpBin,
                    $this->projectDir,
                    $this->environment,
                    $bank->getBankId()
                )
            );

            exec($cmd);
        }
    }

    /**
     * Saves bank.
     */
    protected function doSave(Member $member, Bank $bank): bool
    {
        if ($member === $bank->getMember()) {
            try {
                if (null === $bank->getBankId()) {
                    $banks = $bank->getMember()->getBanks();
                    $order = count($banks) + 1;

                    $bank->setSortOrder($order);
                }

                $this->em->persist($bank);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }
}
