<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Bank;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\PaymentMethod;
use App\Form\Model\AccountFormModel;
use App\Form\Type\AccountFormType;
use App\Repository\AccountRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

class AccountService
{
    private LoggerInterface $logger;
    private EntityManagerInterface $em;
    private FormFactoryInterface $formFactory;
    private ValidatorInterface $validator;
    private TranslatorInterface $translator;
    private OperationService $operationService;
    private AccountRepository $accountRepository;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        TranslatorInterface $translator,
        OperationService $operationService,
        AccountRepository $accountRepository
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->translator = $translator;
        $this->operationService = $operationService;
        $this->accountRepository = $accountRepository;
    }

    /**
     * Returns accounts list.
     */
    public function getList(Member $member, Bank $bank = null, bool $deleted = true): ArrayCollection
    {
        return $this->accountRepository->getList($member, $bank, $deleted);
    }

    /**
     * Returns account form for a new account.
     */
    public function getCreateForm(Member $member, Bank $bank = null): ?FormInterface
    {
        if (null !== $bank && $member !== $bank->getMember()) {
            return null;
        }

        $formModel = new AccountFormModel();
        $formModel->bank = $bank;

        return $this->formFactory->create(AccountFormType::class, $formModel, ['member' => $member]);
    }

    /**
     * Returns account form for an existing account.
     */
    public function getUpdateForm(Member $member, Account $account): ?FormInterface
    {
        if ($member !== $account->getBank()->getMember()) {
            return null;
        }

        $formModel = new AccountFormModel();
        $formModel->accountId = $account->getAccountId();
        $formModel->name = $account->getName();
        $formModel->bank = $account->getBank();
        $formModel->currency = $account->getCurrency();
        $formModel->overdraftFacility = $account->getOverdraftFacility();

        return $this->formFactory->create(AccountFormType::class, $formModel, ['member' => $member]);
    }

    /**
     * Saves account form.
     */
    public function saveForm(Member $member, ?Account $account, FormInterface $form): ?Account
    {
        if ($form->isValid()) {
            $formModel = $form->getData();

            if (null === $account) {
                $account = new Account();
            }

            $account->setName($formModel->name);
            $account->setBank($formModel->bank);
            $account->setCurrency($formModel->currency);
            $account->setOverdraftFacility($formModel->overdraftFacility);
            $this->doSave($member, $account);

            if (null !== $formModel->initialBalance) {
                $operation = new Operation();
                $operation->setAccount($account);
                $operation->setThirdParty($this->translator->trans('account.initial_balance'));
                $operation->setPaymentMethod($this->em->find(PaymentMethod::class, PaymentMethod::PAYMENT_METHOD_ID_INITIAL_BALANCE));
                if ($formModel->initialBalance > 0) {
                    $operation->setCredit(abs($formModel->initialBalance));
                } else {
                    $operation->setDebit(abs($formModel->initialBalance));
                }
                $operation->setValueDate(new \DateTime());
                $operation->setReconciled(true);

                $this->operationService->save($member, $operation);
            }

            return $account;
        }

        return null;
    }

    /**
     * Closes accounts.
     */
    public function close(Member $member, array $accountsId): bool
    {
        try {
            foreach ($accountsId as $accountId) {
                $account = $this->em->find(Account::class, $accountId);

                if (null !== $account) {
                    if ($member === $account->getBank()->getMember()) {
                        $account->setClosed(true);
                    }
                }
            }

            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());

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
                $account = $this->em->find(Account::class, $accountId);

                if (null !== $account) {
                    if ($member === $account->getBank()->getMember()) {
                        $account->setDeleted(true);
                    }
                }
            }

            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());

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
            $balance = $this->accountRepository->getBalance($account, $reconciledOnly);
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
                        $this->logger->error($e->getMessage());
                        $error = true;

                        continue;
                    }
                } else {
                    $this->logger->error(
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
            $this->logger->error($e->getMessage());
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
            /** @var Account */
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
                $this->logger->error($e->getMessage());
            }
        }

        return false;
    }
}
