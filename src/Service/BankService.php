<?php

namespace App\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Process\PhpExecutableFinder;
use Psr\Log\LoggerInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use App\Entity\Member;
use App\Entity\Bank;
use App\Service\AccountService;
use App\Form\Type\BankChooseFormType;
use App\Form\Type\BankUpdateFormType;

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
    )
    {
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
     *
     * @param Member $member     Member entity
     * @param bool   $activeOnly Return active banks only
     *
     * @return array
     */
    public function getList(Member $member, $activeOnly = true)
    {
        $banks = [];

        $sql = 'SELECT ( ';
        $sql .= '  SELECT COALESCE(SUM(operation.credit), 0) - COALESCE(SUM(operation.debit), 0) ';
        $sql .= '  FROM operation ';
        $sql .= '  WHERE account.account_id = operation.account_id ';
        $sql .= ') AS account_balance, ';
        $sql .= 'bank.bank_id, bank.provider_id AS bank_provider_id, bank.name AS bank_name, bank.is_favorite AS bank_is_favorite, bank.is_closed AS bank_is_closed, bank.is_deleted AS bank_is_deleted, ';
        $sql .= 'account.account_id, account.name AS account_name, account.currency AS account_currency, account.overdraft_facility AS account_overdraft_facility, account.is_deleted AS account_is_deleted ';
        $sql .= 'FROM bank ';
        $sql .= 'LEFT JOIN account ON bank.bank_id = account.bank_id AND account.is_deleted = false ';
        $sql .= 'WHERE bank.member_id = :member_id ';
        $sql .= 'AND bank.is_deleted = false ';
        if ($activeOnly) {
            $sql .= 'AND bank.is_closed = false ';
        }
        $sql .= 'ORDER BY bank.sort_order ASC, account.name ASC ';

        $stmt = $this->em->getConnection()->prepare($sql);
        $stmt->execute(
            [
                ':member_id' => $member->getMemberId(),
            ]
        );

        foreach ($stmt->fetchAll() as $row) {
            if (!isset($banks[$row['bank_id']])) {
                $banks[$row['bank_id']] = [
                    'bankId' => $row['bank_id'],
                    'name' => $row['bank_name'],
                    'favorite' => $row['bank_is_favorite'],
                    'closed' => $row['bank_is_closed'],
                    'deleted' => $row['bank_is_deleted'],
                    'active' => !$row['bank_is_deleted'] && !$row['bank_is_closed'],
                    'manual' => (null === $row['bank_provider_id']),
                    'accounts' => [],
                ];
            }

            if (isset($row['account_id'])) {
                $banks[$row['bank_id']]['accounts'][$row['account_id']] = [
                    'accountId' => $row['account_id'],
                    'name' => $row['account_name'],
                    'currency' => $row['account_currency'],
                    'overdraftFacility' => $row['account_overdraft_facility'],
                    'deleted' => $row['account_is_deleted'],
                    'balance' => $row['account_balance'],
                ];
            }
        }

        return $banks;
    }

    /**
     * Returns bank form.
     *
     * @param Member $member Member entity
     * @param Bank   $bank   Bank entity
     *
     * @return Form
     */
    public function getForm(Member $member, Bank $bank = null)
    {
        if (null === $bank) {
            return $this->formFactory->create(BankChooseFormType::class, null, ['member' => $member]);
        } elseif ($member === $bank->getMember()) {
            return $this->formFactory->create(BankUpdateFormType::class, $bank);
        }
    }

    /**
     * Saves bank.
     *
     * @param Member $member Member entity
     * @param Bank   $bank   Bank entity
     *
     * @return bool
     */
    protected function doSave(Member $member, Bank $bank)
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

    /**
     * Saves bank.
     *
     * @param Member $member Member entity
     * @param Bank   $bank   Bank entity
     *
     * @return bool
     */
    public function save(Member $member, Bank $bank)
    {
        $errors = $this->validator->validate($bank);

        if (0 == count($errors)) {
            return $this->doSave($member, $bank);
        }

        return false;
    }

    /**
     * Saves bank form.
     *
     * @param Member $member Member entity
     * @param Form   $form   Bank form
     *
     * @return Bank
     */
    public function saveForm(Member $member, Form $form)
    {
        if ($form->isValid()) {
            if ($form->getData() instanceof Bank) {
                $this->doSave($member, $form->getData());

                return $form->getData();
            } else {
                $data = $form->getData();

                if (null !== $data['provider']) {
                    $bank = new Bank();
                    $bank->setMember($member);
                    $bank->setProvider($data['provider']);
                    $bank->setName($data['provider']->getName());

                    $this->doSave($member, $bank);

                    return $bank;
                } elseif (null === $data['bank']) {
                    $bank = new Bank();
                    $bank->setMember($member);
                    $bank->setName($data['other']);

                    $this->doSave($member, $bank);

                    return $bank;
                } else {
                    return $data['bank'];
                }
            }
        }

        return false;
    }

    /**
     * Closes banks.
     *
     * @param Member $member  Member entity
     * @param array  $banksId Banks id to close
     *
     * @return bool
     */
    public function close(Member $member, array $banksId)
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
     *
     * @param Member $member  Member entity
     * @param array  $banksId Banks id to delete
     *
     * @return bool
     */
    public function delete(Member $member, array $banksId)
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
     *
     * @param Member $member Member entity
     * @param Bank   $bank   Bank entity
     *
     * @return array
     */
    public function getBalances(Member $member, Bank $bank)
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
     *
     * @param Bank $bank Bank entity
     */
    public function importExternalBank(Bank $bank)
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
}
