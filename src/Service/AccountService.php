<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Bank;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\PaymentMethod;
use App\Form\Type\AccountFormType;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

class AccountService
{
    private $logger;
    private $em;
    private $formFactory;
    private $validator;
    private $translator;
    private $operationService;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        TranslatorInterface $translator,
        OperationService $operationService
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->translator = $translator;
        $this->operationService = $operationService;
    }

    /**
     * Returns accounts list.
     */
    public function getList(Member $member, Bank $bank = null, bool $deleted = true): ArrayCollection
    {
        return $this->em->getRepository(Account::class)->getList($member, $bank, $deleted);
    }

    /**
     * Returns account form for a new account.
     */
    public function getCreateForm(Member $member, Bank $bank = null): ?Form
    {
        if (null !== $bank && $member !== $bank->getMember()) {
            return null;
        }

        $account = new Account();
        if (null !== $bank) {
            $account->setBank($bank);
        }

        return $this->formFactory->create(AccountFormType::class, $account, ['member' => $member]);
    }

    /**
     * Returns account form for an existing account.
     */
    public function getUpdateForm(Member $member, Account $account): ?Form
    {
        if ($member !== $account->getBank()->getMember()) {
            return null;
        }

        return $this->formFactory->create(AccountFormType::class, $account, ['member' => $member]);
    }

    /**
     * Saves account.
     */
    public function save(Member $member, Account $account): bool
    {
        $errors = $this->validator->validate($account);

        if (0 === count($errors)) {
            return $this->doSave($member, $account);
        }

        return false;
    }

    /**
     * Saves account form.
     */
    public function saveForm(Member $member, Form $form): bool
    {
        if ($form->isValid()) {
            $ok = $this->doSave($member, $form->getData());

            if ($form->has('initialBalance') && null !== $form->get('initialBalance')->getData()) {
                $operation = new Operation();
                $operation->setAccount($form->getData());
                $operation->setThirdParty($this->translator->trans('account.initial_balance'));
                $operation->setPaymentMethod($this->em->find('App:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_INITIAL_BALANCE));
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
     */
    public function close(Member $member, array $accountsId): bool
    {
        try {
            foreach ($accountsId as $accountId) {
                $account = $this->em->find('App:Account', $accountId);

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
     */
    public function delete(Member $member, array $accountsId): bool
    {
        try {
            foreach ($accountsId as $accountId) {
                $account = $this->em->find('App:Account', $accountId);

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
     */
    public function getBalance(Member $member, Account $account, bool $reconciledOnly = false): int
    {
        $balance = 0;
        if ($member === $account->getBank()->getMember()) {
            $balance = $this->em->getRepository(Account::class)->getBalance($account, $reconciledOnly);
        }

        return $balance;
    }

    /**
     * Saves multiple accounts.
     */
    public function saveMulti(Bank $bank, array $accounts): bool
    {
        $error = false;

        // Retrieve current accounts id
        $currentAccounts = $bank->getAccounts();
        $currentAccountsExternalId = [];

        foreach ($currentAccounts as $currentAccount) {
            if (null !== $currentAccount->getExternalAccountId()) {
                $currentAccountsExternalId[] = $currentAccount->getExternalAccountId();
            }
        }

        foreach ($accounts as $accountArray) {
            if (!in_array($accountArray['external_account_id'], $currentAccountsExternalId, true)) {
                $account = new Account();
                $account->setBank($bank);
                $account->setName($accountArray['name']);
                $account->setExternalAccountId($accountArray['external_account_id']);
                $account->setCurrency($accountArray['currency']);

                $errors = $this->validator->validate($account);

                if (0 === count($errors)) {
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

        return !$error;
    }

    /**
     * Saves account.
     */
    protected function doSave(Member $member, Account $account): bool
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
}
