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
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Process\PhpExecutableFinder;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class BankService
{
    private LoggerInterface $logger;
    private EntityManagerInterface $entityManager;
    private FormFactoryInterface $formFactory;
    private ValidatorInterface $validator;
    private AccountService $accountService;
    private BankRepository $bankRepository;
    private string $projectDir;
    private string $environment;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $entityManager,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        AccountService $accountService,
        BankRepository $bankRepository,
        $projectDir,
        $environment
    ) {
        $this->logger = $logger;
        $this->entityManager = $entityManager;
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
     * Returns create bank form.
     */
    public function getCreateForm(Bank $bank): FormInterface
    {
        $formModel = new BankChooseFormModel();

        return $this->formFactory->create(
            BankChooseFormType::class,
            $formModel,
            ['member' => $bank->getMember()]
        );
    }

    /**
     * Returns edit bank form.
     */
    public function getEditForm(Bank $bank): FormInterface
    {
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

    /**
     * Saves bank form.
     */
    public function saveForm(Bank $bank, $formModel)
    {
        $errors = $this->validator->validate($formModel);
        if (0 !== count($errors)) {
            return false;
        }

        if ($formModel instanceof BankChooseFormModel) {
            if (null !== $formModel->provider) {
                $bank->setProvider($formModel->provider);
                $bank->setName($formModel->provider->getName());
            } elseif (null === $formModel->bank) {
                $bank->setName($formModel->other);
            }
        } else {
            $bank->setName($formModel->name);
        }

        $this->doSave($bank);

        return true;
    }

    /**
     * Closes banks.
     */
    public function close(array $banks): bool
    {
        try {
            foreach ($banks as $bank) {
                $bank->setClosed(true);
            }

            $this->entityManager->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Deletes banks.
     */
    public function delete(array $banks): bool
    {
        try {
            foreach ($banks as $bank) {
                $bank->setDeleted(true);
            }

            $this->entityManager->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Gets bank balances.
     */
    public function getBalances(Bank $bank): array
    {
        $balances = [];

        $accounts = $bank->getAccounts();
        foreach ($accounts as $account) {
            if (!$account->isDeleted()) {
                $accountBalance = $this->accountService->getBalance($bank->getMember(), $account);

                if (isset($balances[$account->getCurrency()])) {
                    $balances[$account->getCurrency()] += $accountBalance;
                } else {
                    $balances[$account->getCurrency()] = $accountBalance;
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
                $this->logger->error('Unable to find php binary');

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
    protected function doSave(Bank $bank): bool
    {
        try {
            if (null === $bank->getBankId()) {
                $banks = $bank->getMember()->getBanks();
                $order = count($banks) + 1;

                $bank->setSortOrder($order);
            }

            $this->entityManager->persist($bank);
            $this->entityManager->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());
        }

        return false;
    }
}
