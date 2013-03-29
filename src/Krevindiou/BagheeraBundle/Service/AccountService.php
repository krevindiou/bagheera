<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\Validator\Validator;
use Symfony\Component\Translation\Translator;
use Symfony\Bridge\Monolog\Logger;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\User;
use Krevindiou\BagheeraBundle\Entity\Bank;
use Krevindiou\BagheeraBundle\Entity\Account;
use Krevindiou\BagheeraBundle\Entity\Operation;
use Krevindiou\BagheeraBundle\Entity\PaymentMethod;

/**
 * @DI\Service("bagheera.account")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "account"})
 */
class AccountService
{
    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /** @DI\Inject */
    public $validator;

    /** @DI\Inject */
    public $translator;

    /** @DI\Inject("bagheera.provider_adapter") */
    public $providerAdapter;

    /** @DI\Inject("bagheera.account_import") */
    public $accountImportService;

    /** @DI\Inject("bagheera.operation") */
    public $operationService;

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

        $query = $this->em->createQuery($dql);
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

        return $this->formFactory->create('account_type', $account);
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

        return $this->formFactory->create('account_type', $account);
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
            $oldAccount = $this->em->getUnitOfWork()->getOriginalEntityData($account);

            if ($user !== $oldAccount['bank']->getUser()) {
                return false;
            }
        }

        if ($user === $account->getBank()->getUser()) {
            try {
                $this->em->persist($account);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
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
        $errors = $this->validator->validate($account);

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
            $ok = $this->_save($user, $form->getData());

            if ($form->has('initialBalance') && $form->get('initialBalance')->getData() != 0) {
                $operation = new Operation();
                $operation->setAccount($form->getData());
                $operation->setThirdParty($this->translator->trans('account_initial_balance'));
                if ($form->get('initialBalance')->getData() > 0) {
                    $operation->setPaymentMethod($this->em->find('KrevindiouBagheeraBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER));
                    $operation->setCredit(abs($form->get('initialBalance')->getData()));
                } else {
                    $operation->setPaymentMethod($this->em->find('KrevindiouBagheeraBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER));
                    $operation->setDebit(abs($form->get('initialBalance')->getData()));
                }
                $operation->setValueDate(new \DateTime());
                $operation->setIsReconciled(true);

                $this->operationService->save($user, $operation);
            }

            return $ok;
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
                $account = $this->em->find('KrevindiouBagheeraBundle:Account', $accountId);

                if (null !== $account) {
                    if ($user === $account->getBank()->getUser()) {
                        $account->setIsDeleted(true);
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
            $dql = 'SELECT (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS balance ';
            $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
            $dql.= 'WHERE o.account = :account ';
            if ($reconciledOnly) {
                $dql.= 'AND o.isReconciled = 1 ';
            }

            $query = $this->em->createQuery($dql);
            $query->setParameter('account', $account);
            $result = $query->getSingleResult();

            $balance = $result['balance'];
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

                    $errors = $this->validator->validate($account);

                    if (0 == count($errors)) {
                        try {
                            $this->em->persist($account);
                        } catch (\Exception $e) {
                            $this->logger->err($e->getMessage());
                            $error = true;
                            continue;
                        }
                    } else {
                        $this->logger->err(
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
                $this->em->flush();
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
                $error = true;
            }
        }

        return !$error;
    }
}
