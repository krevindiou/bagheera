<?php

namespace AppBundle\Service;

use Symfony\Component\Form\Form;
use JMS\DiExtraBundle\Annotation as DI;
use AppBundle\Entity\Member;
use AppBundle\Entity\Bank;
use AppBundle\Entity\Account;
use AppBundle\Entity\Operation;
use AppBundle\Entity\PaymentMethod;

/**
 * @DI\Service("app.account")
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

    /** @DI\Inject("app.operation") */
    public $operationService;

    /**
     * Returns accounts list.
     *
     * @param Member $member  Member entity
     * @param Bank   $bank    Bank entity
     * @param bool   $deleted Return deleted items
     *
     * @return array
     */
    public function getList(Member $member, Bank $bank = null, $deleted = true)
    {
        $dql = 'SELECT a FROM AppBundle:Account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        if (null !== $bank) {
            $dql .= 'AND a.bank = :bank ';
        }
        if (!$deleted) {
            $dql .= 'AND b.deleted = false ';
            $dql .= 'AND a.deleted = false ';
        }
        $dql .= 'ORDER BY a.name ASC';

        $query = $this->em->createQuery($dql);
        $query->setParameter('member', $member);
        if (null !== $bank) {
            $query->setParameter('bank', $bank);
        }

        return $query->getResult();
    }

    /**
     * Returns account form for a new account.
     *
     * @param Member $member Member entity
     * @param Bank   $bank   Bank entity
     *
     * @return Form
     */
    public function getCreateForm(Member $member, Bank $bank = null)
    {
        if (null !== $bank && $member !== $bank->getMember()) {
            return;
        }

        $account = new Account();
        if (null !== $bank) {
            $account->setBank($bank);
        }

        return $this->formFactory->create('app_account', $account, ['member' => $member]);
    }

    /**
     * Returns account form for an existing account.
     *
     * @param Member  $member  Member entity
     * @param Account $account Account entity
     *
     * @return Form
     */
    public function getUpdateForm(Member $member, Account $account)
    {
        if ($member !== $account->getBank()->getMember()) {
            return;
        }

        return $this->formFactory->create('app_account', $account, ['member' => $member]);
    }

    /**
     * Saves account.
     *
     * @param Member  $member  Member entity
     * @param Account $account Account entity
     *
     * @return bool
     */
    protected function doSave(Member $member, Account $account)
    {
        if (null !== $account->getAccountId()) {
            $oldAccount = $this->em->getUnitOfWork()->getOriginalEntityData($account);

            if ($member !== $oldAccount['bank']->getMember()) {
                return false;
            }
        }

        if ($member === $account->getBank()->getMember()) {
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
     * Saves account.
     *
     * @param Member  $member  Member entity
     * @param Account $account Account entity
     *
     * @return bool
     */
    public function save(Member $member, Account $account)
    {
        $errors = $this->validator->validate($account);

        if (0 == count($errors)) {
            return $this->doSave($member, $account);
        }

        return false;
    }

    /**
     * Saves account form.
     *
     * @param Member $member Member entity
     * @param Form   $form   Account form
     *
     * @return bool
     */
    public function saveForm(Member $member, Form $form)
    {
        if ($form->isValid()) {
            $ok = $this->doSave($member, $form->getData());

            if ($form->has('initialBalance') && $form->get('initialBalance')->getData() != 0) {
                $operation = new Operation();
                $operation->setAccount($form->getData());
                $operation->setThirdParty($this->translator->trans('account.initial_balance'));
                $operation->setPaymentMethod($this->em->find('AppBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_INITIAL_BALANCE));
                if ($form->get('initialBalance')->getData() > 0) {
                    $operation->setCredit(abs($form->get('initialBalance')->getData()));
                } else {
                    $operation->setDebit(abs($form->get('initialBalance')->getData()));
                }
                $operation->setValueDate(new \DateTime());
                $operation->setReconciled(true);

                $this->operationService->save($member, $operation);
            }

            return $ok;
        }

        return false;
    }

    /**
     * Closes accounts.
     *
     * @param Member $member     Member entity
     * @param array  $accountsId Accounts id to close
     *
     * @return bool
     */
    public function close(Member $member, array $accountsId)
    {
        try {
            foreach ($accountsId as $accountId) {
                $account = $this->em->find('AppBundle:Account', $accountId);

                if (null !== $account) {
                    if ($member === $account->getBank()->getMember()) {
                        $account->setClosed(true);
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
     * Deletes accounts.
     *
     * @param Member $member     Member entity
     * @param array  $accountsId Accounts id to delete
     *
     * @return bool
     */
    public function delete(Member $member, array $accountsId)
    {
        try {
            foreach ($accountsId as $accountId) {
                $account = $this->em->find('AppBundle:Account', $accountId);

                if (null !== $account) {
                    if ($member === $account->getBank()->getMember()) {
                        $account->setDeleted(true);
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
     * Gets account balance.
     *
     * @param Member  $member         Member entity
     * @param Account $account        Account entity
     * @param bool    $reconciledOnly Only consider reconciled operations
     *
     * @return float
     */
    public function getBalance(Member $member, Account $account, $reconciledOnly = false)
    {
        $balance = 0;

        if ($member === $account->getBank()->getMember()) {
            $dql = 'SELECT (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS balance ';
            $dql .= 'FROM AppBundle:Operation o ';
            $dql .= 'WHERE o.account = :account ';
            if ($reconciledOnly) {
                $dql .= 'AND o.reconciled = true ';
            }

            $query = $this->em->createQuery($dql);
            $query->setParameter('account', $account);
            $result = $query->getSingleResult();

            $balance = $result['balance'];
        }

        return sprintf('%.2f', $balance);
    }

    /**
     * Saves multiple accounts.
     *
     * @param Bank  $bank     Bank entity
     * @param array $accounts Accounts data
     *
     * @return bool
     */
    public function saveMulti(Bank $bank, array $accounts)
    {
        $error = false;

        if ($member !== $bank->getMember()) {
            $error = true;
        } else {
            // Retrieve current accounts id
            $currentAccounts = $bank->getAccounts();
            $currentAccountsExternalId = [];

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
                                'Errors saving account "%s" [member %d]',
                                $accountArray['name'],
                                $bank->getMember()->getMemberId()
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
