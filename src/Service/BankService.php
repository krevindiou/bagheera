<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Bank;
use App\Entity\Member;
use App\Form\Type\BankChooseFormType;
use App\Form\Type\BankUpdateFormType;
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
    private $projectDir;
    private $environment;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        AccountService $accountService,
        $projectDir,
        $environment
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->accountService = $accountService;
        $this->projectDir = $projectDir;
        $this->environment = $environment;
    }

    /**
     * Returns banks list.
     */
    public function getList(Member $member, bool $activeOnly = true): ArrayCollection
    {
        return $this->em->getRepository('App:Bank')->getList($member, $activeOnly);
    }

    /**
     * Returns bank form.
     */
    public function getForm(Member $member, Bank $bank = null): ?Form
    {
        if (null === $bank) {
            return $this->formFactory->create(BankChooseFormType::class, null, ['member' => $member]);
        }
        if ($member === $bank->getMember()) {
            return $this->formFactory->create(BankUpdateFormType::class, $bank);
        }

        return null;
    }

    /**
     * Saves bank.
     */
    public function save(Member $member, Bank $bank): bool
    {
        $errors = $this->validator->validate($bank);

        if (0 === count($errors)) {
            return $this->doSave($member, $bank);
        }

        return false;
    }

    /**
     * Saves bank form.
     */
    public function saveForm(Member $member, Form $form)
    {
        if ($form->isValid()) {
            if ($form->getData() instanceof Bank) {
                $this->doSave($member, $form->getData());

                return $form->getData();
            }
            $data = $form->getData();

            if (null !== $data['provider']) {
                $bank = new Bank();
                $bank->setMember($member);
                $bank->setProvider($data['provider']);
                $bank->setName($data['provider']->getName());

                $this->doSave($member, $bank);

                return $bank;
            }
            if (null === $data['bank']) {
                $bank = new Bank();
                $bank->setMember($member);
                $bank->setName($data['other']);

                $this->doSave($member, $bank);

                return $bank;
            }

            return $data['bank'];
        }

        return false;
    }

    /**
     * Closes banks.
     */
    public function close(Member $member, array $banksId): bool
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->em->find('App:Bank', $bankId);

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
                $bank = $this->em->find('App:Bank', $bankId);

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
                        $balances[$account->getCurrency()] += sprintf('%.2f', $accountBalance);
                    } else {
                        $balances[$account->getCurrency()] = sprintf('%.2f', $accountBalance);
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

            if (null === $phpBin) {
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
