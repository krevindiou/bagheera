<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\Validator\Validator,
    Symfony\Component\Process\Process,
    Symfony\Component\Process\PhpExecutableFinder,
    Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Form\AccountForm;

/**
 * Account service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountService
{
    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var FormFactory
     */
    protected $_formFactory;

    /**
     * @var Validator
     */
    protected $_validator;

    /**
     * @var string
     */
    protected $_environment;

    /**
     * @var ProviderServiceFactory
     */
    protected $_providerFactory;

    /**
     * @var AccountImportService
     */
    protected $_accountImportService;


    public function __construct(
        Logger $logger,
        EntityManager $em,
        FormFactory $formFactory,
        Validator $validator,
        $environment,
        Provider\ProviderServiceFactory $providerFactory,
        AccountImportService $accountImportService)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_environment = $environment;
        $this->_providerFactory = $providerFactory;
        $this->_accountImportService = $accountImportService;
    }

    /**
     * Returns accounts list
     *
     * @param  User $user    User entity
     * @param  bool $deleted Return deleted items
     * @return array
     */
    public function getList(User $user, $deleted = true)
    {
        $dql = 'SELECT a FROM KrevindiouBagheeraBundle:Account a ';
        $dql.= 'JOIN a.bank b ';
        $dql.= 'WHERE b.user = :user ';
        if (!$deleted) {
            $dql.= 'AND b.is_deleted = 0 ';
            $dql.= 'AND a.is_deleted = 0 ';
        }
        $dql.= 'ORDER BY a.name ASC';

        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $user);

        return $query->getResult();
    }

    /**
     * Returns account form for a new account
     *
     * @param  User $user       User entity
     * @param  Bank $bank       Bank entity
     * @return Form
     */
    public function getNewForm(User $user, Bank $bank)
    {
        if ($user !== $bank->getUser()) {
            return;
        }

        $account = new Account();
        $account->setBank($bank);

        $form = $this->_formFactory->create(new AccountForm($user), $account);

        return $form;
    }

    /**
     * Returns account form for an existing account
     *
     * @param  User $user       User entity
     * @param  Account $account Account entity
     * @return Form
     */
    public function getEditForm(User $user, Account $account)
    {
        if ($user !== $account->getBank()->getUser()) {
            return;
        }

        $form = $this->_formFactory->create(new AccountForm($user), $account);

        return $form;
    }

    /**
     * Saves account
     *
     * @param  User $user       User entity
     * @param  Account $account Account entity
     * @return boolean
     */
    protected function _save(User $user, Account $account)
    {
        if (null !== $account->getAccountId()) {
            $oldAccount = $this->_em->getUnitOfWork()->getOriginalEntityData($account);

            if ($user !== $oldAccount['bank']->getUser()) {
                return false;
            }
        }

        if ($user === $account->getBank()->getUser()) {
            try {
                $this->_em->persist($account);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Saves account
     *
     * @param  User $user       User entity
     * @param  Account $account Account entity
     * @return boolean
     */
    public function save(User $user, Account $account)
    {
        $errors = $this->_validator->validate($account);

        if (0 == count($errors)) {
            return $this->_save($user, $account);
        }

        return false;
    }

    /**
     * Saves account form
     *
     * @param  User $user User entity
     * @param  Form $form Account form
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
     * Deletes accounts
     *
     * @param  User $user        User entity
     * @param  array $accountsId Accounts id to delete
     * @return boolean
     */
    public function delete(User $user, array $accountsId)
    {
        try {
            foreach ($accountsId as $accountId) {
                $account = $this->_em->find('KrevindiouBagheeraBundle:Account', $accountId);

                if (null !== $account) {
                    if ($user === $account->getBank()->getUser()) {
                        $account->setIsDeleted(true);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Gets account balance
     *
     * @param  User $user              User entity
     * @param  Account $account        Account entity
     * @param  boolean $reconciledOnly Only consider reconciled operations
     * @return float
     */
    public function getBalance(User $user, Account $account, $reconciledOnly = false)
    {
        $balance = 0;

        if ($user === $account->getBank()->getUser()) {
            $dql = 'SELECT COALESCE(SUM(o.credit), 0) AS total_credit, COALESCE(SUM(o.debit), 0) AS total_debit ';
            $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
            $dql.= 'WHERE o.account = :account ';
            if ($reconciledOnly) {
                $dql.= 'AND o.isReconciled = 1 ';
            }

            $query = $this->_em->createQuery($dql);
            $query->setParameter('account', $account);
            $result = $query->getSingleResult();

            $balance = $account->getInitialBalance() + $result['total_credit'] - $result['total_debit'];
        }

        return sprintf('%.2f', $balance);
    }

    /**
     * Retrieve external accounts
     *
     * @param  Bank $bank Bank entity
     * @return void
     */
    public function importExternalAccounts(Bank $bank)
    {
        if (null !== $bank->getExternalUserId()) {
            $provider = $this->_providerFactory->get($bank);
            if (null !== $provider) {
                $externalAccounts = $provider->retrieveAccounts($bank->getExternalUserId());

                $externalAccountsLabel = array();
                foreach ($externalAccounts as $externalAccount) {
                    $externalAccountsLabel[] = $externalAccount['label'];
                }

                $this->_logger->info(sprintf('Importing accounts: %s', implode(', ', $externalAccountsLabel)));

                $this->saveExternalAccounts($bank->getUser(), $bank, $externalAccounts);

                // Import external transactions
                foreach ($externalAccounts as $k => $externalAccount) {
                    $account = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->findOneBy(
                        array(
                            'bankId' => $bank->getBankId(),
                            'externalAccountId' => $externalAccount['account_id']
                        )
                    );

                    if (null !== $account) {
                        $externalAccounts[$k]['account'] = $account;

                        $this->_accountImportService->initImport($account, 0);
                    }
                }

                foreach ($externalAccounts as $externalAccount) {
                    if (isset($externalAccount['account'])) {
                        $this->importExternalTransactions($externalAccount['account']);
                    }
                }
            }
        }
    }

    /**
     * Retrieve external transactions
     *
     * @param  Account $account Account entity
     * @return void
     */
    public function importExternalTransactions(Account $account)
    {
        if (null !== $account->getBank()->getExternalUserId()) {
            $this->executableFinder = new PhpExecutableFinder();

            $phpBin = $this->executableFinder->find();

            if (null === $phpBin) {
                $this->_logger->err('Unable to find php binary');
                return;
            }

            $process = new Process(
                sprintf(
                    '%s app/console --env=%s bagheera:import_external_transactions %d',
                    $phpBin,
                    $this->_environment,
                    $account->getAccountId()
                ),
                realpath(__DIR__ . '/../../../..')
            );

            $process->start();
        }
    }

    /**
     * Saves external accounts from array
     *
     * @param  User $user               User entity
     * @param  Bank $bank               Bank entity
     * @param  array $externalAccounts  Accounts data
     * @return boolean
     */
    public function saveExternalAccounts(User $user, Bank $bank, array $externalAccounts)
    {
        $error = false;

        // Retrieve current accounts id
        $currentAccounts = $bank->getAccounts();
        $currentAccountsExternalId = array();

        foreach ($currentAccounts as $currentAccount) {
            if (null !== $currentAccount->getExternalAccountId()) {
                $currentAccountsExternalId[] = $currentAccount->getExternalAccountId();
            }
        }

        foreach ($externalAccounts as $externalAccount) {
            if (!in_array($externalAccount['account_id'], $currentAccountsExternalId)) {
                $account = new Account();
                $account->setBank($bank);
                $account->setName($externalAccount['label']);
                $account->setExternalAccountId($externalAccount['account_id']);
                $account->setIban($externalAccount['iban']);
                $account->setBic($externalAccount['bic']);

                $errors = $this->_validator->validate($account);

                if (0 == count($errors)) {
                    try {
                        $this->_em->persist($account);
                    } catch (\Exception $e) {
                        $this->_logger->err($e->getMessage());
                        $error = true;
                        continue;
                    }
                } else {
                    $this->_logger->err(sprintf('Errors importing account "%s" [user %d]', $externalAccount['label'], $bank->getUser()->getUserId()));
                    $error = true;
                    continue;
                }
            }
        }

        try {
            $this->_em->flush();
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());
            $error = true;
        }

        return !$error;
    }
}
