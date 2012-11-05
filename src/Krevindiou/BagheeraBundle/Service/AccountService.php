<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\Validator\Validator,
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
     * @var ProviderAdapter
     */
    protected $_providerAdapter;

    /**
     * @var AccountImportService
     */
    protected $_accountImportService;

    public function __construct(
        Logger $logger,
        EntityManager $em,
        FormFactory $formFactory,
        Validator $validator,
        Provider\ProviderAdapter $providerAdapter,
        AccountImportService $accountImportService)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_providerAdapter = $providerAdapter;
        $this->_accountImportService = $accountImportService;
    }

    /**
     * Returns accounts list
     *
     * @param  User  $user    User entity
     * @param  Bank  $bank    Bank entity
     * @param  bool  $deleted Return deleted items
     * @return array
     */
    public function getList(User $user, Bank $bank = null, $deleted = true)
    {
        $dql = 'SELECT a FROM KrevindiouBagheeraBundle:Account a ';
        $dql.= 'JOIN a.bank b ';
        $dql.= 'WHERE b.user = :user ';
        if (null !== $bank) {
            $dql.= 'AND a.bank = :bank ';
        }
        if (!$deleted) {
            $dql.= 'AND b.isDeleted = 0 ';
            $dql.= 'AND a.isDeleted = 0 ';
        }
        $dql.= 'ORDER BY a.name ASC';

        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $user);
        if (null !== $bank) {
            $query->setParameter('bank', $bank);
        }

        return $query->getResult();
    }

    /**
     * Returns account form for a new account
     *
     * @param  User $user User entity
     * @param  Bank $bank Bank entity
     * @return Form
     */
    public function getNewForm(User $user, Bank $bank)
    {
        if ($user !== $bank->getUser()) {
            return;
        }

        $account = new Account();
        $account->setBank($bank);

        $form = $this->_formFactory->create(new AccountForm(), $account);

        return $form;
    }

    /**
     * Returns account form for an existing account
     *
     * @param  User    $user    User entity
     * @param  Account $account Account entity
     * @return Form
     */
    public function getEditForm(User $user, Account $account)
    {
        if ($user !== $account->getBank()->getUser()) {
            return;
        }

        $form = $this->_formFactory->create(new AccountForm(), $account);

        return $form;
    }

    /**
     * Saves account
     *
     * @param  User    $user    User entity
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
     * @param  User    $user    User entity
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
     * @param  User    $user User entity
     * @param  Form    $form Account form
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
     * @param  User    $user       User entity
     * @param  array   $accountsId Accounts id to delete
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
     * @param  User    $user           User entity
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
     * Saves multiple accounts
     *
     * @param  User    $user     User entity
     * @param  Bank    $bank     Bank entity
     * @param  array   $accounts Accounts data
     * @return boolean
     */
    public function saveMulti(User $user, Bank $bank, array $accounts)
    {
        $error = false;

        if ($user !== $bank->getUser()) {
            $error = true;
        } else {
            // Retrieve current accounts id
            $currentAccounts = $bank->getAccounts();
            $currentAccountsExternalId = array();

            foreach ($currentAccounts as $currentAccount) {
                if (null !== $currentAccount->getExternalAccountId()) {
                    $currentAccountsExternalId[] = $currentAccount->getExternalAccountId();
                }
            }

            foreach ($accounts as $accountArray) {
                if (!in_array($accountArray['external_account_id'], $currentAccountsExternalId)) {
                    $account = new Account();
                    $account->setBank($bank);
                    $account->setName($accountArray['name']);
                    $account->setExternalAccountId($accountArray['external_account_id']);
                    $account->setCurrency($accountArray['currency']);
                    $account->setIban(isset($accountArray['iban']) ? $accountArray['iban'] : null);
                    $account->setBic(isset($accountArray['bic']) ? $accountArray['bic'] : null);

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
                        $this->_logger->err(
                            sprintf(
                                'Errors saving account "%s" [user %d]',
                                $accountArray['name'],
                                $bank->getUser()->getUserId()
                            )
                        );

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
        }

        return !$error;
    }
}
