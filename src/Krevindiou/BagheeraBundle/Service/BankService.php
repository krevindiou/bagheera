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
use Krevindiou\BagheeraBundle\Entity\User;
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
     * @param  User  $user    User entity
     * @param  bool  $deleted Return deleted items
     * @return array
     */
    public function getList(User $user, $deleted = true)
    {
        $dql = 'SELECT b FROM KrevindiouBagheeraBundle:Bank b ';
        $dql.= 'WHERE b.user = :user ';
        if (!$deleted) {
            $dql.= 'AND b.deleted = 0 ';
        }
        $dql.= 'ORDER BY b.sortOrder ASC';

        $query = $this->em->createQuery($dql);
        $query->setParameter('user', $user);

        return $query->getResult();
    }

    /**
     * Returns bank form
     *
     * @param  User $user User entity
     * @param  Bank $bank Bank entity
     * @return Form
     */
    public function getForm(User $user, Bank $bank = null)
    {
        if (null === $bank) {
            $bank = new Bank();
            $bank->setUser($user);
        } elseif ($user !== $bank->getUser()) {
            return;
        }

        return $this->formFactory->create('bank_type', $bank);
    }

    /**
     * Saves bank
     *
     * @param  User    $user User entity
     * @param  Bank    $bank Bank entity
     * @return boolean
     */
    protected function doSave(User $user, Bank $bank)
    {
        if ($user === $bank->getUser()) {
            try {
                if (null === $bank->getBankId()) {
                    $banks = $bank->getUser()->getBanks();
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
     * @param  User    $user User entity
     * @param  Bank    $bank Bank entity
     * @return boolean
     */
    public function save(User $user, Bank $bank)
    {
        $errors = $this->validator->validate($bank);

        if (0 == count($errors)) {
            return $this->doSave($user, $bank);
        }

        return false;
    }

    /**
     * Saves bank form
     *
     * @param  User    $user User entity
     * @param  Form    $form Bank form
     * @return boolean
     */
    public function saveForm(User $user, Form $form)
    {
        if ($form->isValid()) {
            return $this->doSave($user, $form->getData());
        }

        return false;
    }

    /**
     * Deletes banks
     *
     * @param  User    $user    User entity
     * @param  array   $banksId Banks id to delete
     * @return boolean
     */
    public function delete(User $user, array $banksId)
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->em->find('KrevindiouBagheeraBundle:Bank', $bankId);

                if (null !== $bank) {
                    if ($user === $bank->getUser()) {
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
     * @param  User  $user User entity
     * @param  Bank  $bank Bank entity
     * @return array
     */
    public function getBalances(User $user, Bank $bank)
    {
        $balances = array();

        if ($user === $bank->getUser()) {
            $accounts = $bank->getAccounts();
            foreach ($accounts as $account) {
                if (!$account->isDeleted()) {
                    $accountBalance = $this->accountService->getBalance($user, $account);

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
