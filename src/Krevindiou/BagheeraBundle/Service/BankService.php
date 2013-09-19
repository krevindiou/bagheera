<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\Validator\Validator;
use Symfony\Bridge\Monolog\Logger;
use Symfony\Component\Process\PhpExecutableFinder;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\Member;
use Krevindiou\BagheeraBundle\Entity\Bank;

/**
 * @DI\Service("bagheera.bank")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "bank"})
 */
class BankService
{
    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /** @DI\Inject */
    public $validator;

    /** @DI\Inject("bagheera.account") */
    public $accountService;

    /** @DI\Inject("%kernel.root_dir%") */
    public $rootDir;

    /** @DI\Inject("%kernel.environment%") */
    public $environment;

    /**
     * Returns banks list
     *
     * @param  Member $member     Member entity
     * @param  bool   $activeOnly Return active banks only
     * @return array
     */
    public function getList(Member $member, $activeOnly = true)
    {
        $banks = array();

        $sql = 'SELECT ( ';
        $sql.= '  SELECT COALESCE(SUM(operation.credit), 0) - COALESCE(SUM(operation.debit), 0) ';
        $sql.= '  FROM operation ';
        $sql.= '  WHERE account.account_id = operation.account_id ';
        $sql.= ') AS account_balance, ';
        $sql.= 'bank.bank_id, bank.provider_id AS bank_provider_id, bank.name AS bank_name, bank.is_favorite AS bank_is_favorite, bank.is_closed AS bank_is_closed, bank.is_deleted AS bank_is_deleted, ';
        $sql.= 'account.account_id, account.name AS account_name, account.currency AS account_currency, account.overdraft_facility AS account_overdraft_facility, account.is_deleted AS account_is_deleted ';
        $sql.= 'FROM bank ';
        $sql.= 'LEFT JOIN account ON bank.bank_id = account.bank_id AND account.is_deleted = false ';
        $sql.= 'WHERE bank.member_id = :member_id ';
        $sql.= 'AND bank.is_deleted = false ';
        if ($activeOnly) {
            $sql.= 'AND bank.is_closed = false ';
        }
        $sql.= 'ORDER BY bank.sort_order ASC, account.name ASC ';

        $stmt = $this->em->getConnection()->prepare($sql);
        $stmt->execute(
            array(
                ':member_id' => $member->getMemberId()
            )
        );

        foreach ($stmt->fetchAll() as $row) {
            if (!isset($banks[$row['bank_id']])) {
                $banks[$row['bank_id']] = array(
                    'bankId' => $row['bank_id'],
                    'name' => $row['bank_name'],
                    'favorite' => $row['bank_is_favorite'],
                    'closed' => $row['bank_is_closed'],
                    'deleted' => $row['bank_is_deleted'],
                    'active' => !$row['bank_is_deleted'] && !$row['bank_is_closed'],
                    'manual' => (null === $row['bank_provider_id']),
                    'accounts' => array()
                );
            }

            if (isset($row['account_id'])) {
                $banks[$row['bank_id']]['accounts'][$row['account_id']] = array(
                    'accountId' => $row['account_id'],
                    'name' => $row['account_name'],
                    'currency' => $row['account_currency'],
                    'overdraftFacility' => $row['account_overdraft_facility'],
                    'deleted' => $row['account_is_deleted'],
                    'balance' => $row['account_balance'],
                );
            }
        }

        return $banks;
    }

    /**
     * Returns bank form
     *
     * @param  Member $member Member entity
     * @param  Bank   $bank   Bank entity
     * @return Form
     */
    public function getForm(Member $member, Bank $bank = null)
    {
        if (null === $bank) {
            $bank = new Bank();
            $bank->setMember($member);
        } elseif ($member !== $bank->getMember()) {
            return;
        }

        return $this->formFactory->create('bank_type', $bank);
    }

    /**
     * Saves bank
     *
     * @param  Member $member Member entity
     * @param  Bank   $bank   Bank entity
     * @return boolean
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
     * Saves bank
     *
     * @param  Member $member Member entity
     * @param  Bank   $bank   Bank entity
     * @return boolean
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
     * Saves bank form
     *
     * @param  Member $member Member entity
     * @param  Form   $form   Bank form
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
     * Closes banks
     *
     * @param  Member $member  Member entity
     * @param  array  $banksId Banks id to close
     * @return boolean
     */
    public function close(Member $member, array $banksId)
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->em->find('KrevindiouBagheeraBundle:Bank', $bankId);

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
     * Deletes banks
     *
     * @param  Member $member  Member entity
     * @param  array  $banksId Banks id to delete
     * @return boolean
     */
    public function delete(Member $member, array $banksId)
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->em->find('KrevindiouBagheeraBundle:Bank', $bankId);

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
     * Gets bank balances
     *
     * @param  Member $member Member entity
     * @param  Bank   $bank   Bank entity
     * @return array
     */
    public function getBalances(Member $member, Bank $bank)
    {
        $balances = array();

        if ($member === $bank->getMember()) {
            $accounts = $bank->getAccounts();
            foreach ($accounts as $account) {
                if (!$account->isDeleted()) {
                    $accountBalance = $this->accountService->getBalance($member, $account);

                    if (isset($balances[$account->getCurrency()])) {
                        $balances[$account->getCurrency()]+= sprintf('%.2f', $accountBalance);
                    } else {
                        $balances[$account->getCurrency()] = sprintf('%.2f', $accountBalance);
                    }
                }
            }
        }

        return $balances;
    }

    /**
     * Retrieves external bank data
     *
     * @param  Bank $bank Bank entity
     * @return void
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
                    '%s %s/console --env=%s bagheera:import_external_bank %d',
                    $phpBin,
                    $this->rootDir,
                    $this->environment,
                    $bank->getBankId()
                )
            );

            exec($cmd);
        }
    }
}
