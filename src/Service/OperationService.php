<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\PaymentMethod;
use App\Form\Model\OperationFormModel;
use App\Form\Model\OperationSearchFormModel;
use App\Form\Type\OperationFormType;
use App\Repository\OperationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Pagerfanta\Pagerfanta;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class OperationService
{
    private LoggerInterface $logger;
    private EntityManagerInterface $em;
    private FormFactoryInterface $formFactory;
    private ValidatorInterface $validator;
    private OperationRepository $operationRepository;
    private array $categoriesId;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        OperationRepository $operationRepository,
        $categoriesId
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->operationRepository = $operationRepository;
        $this->categoriesId = $categoriesId;
    }

    /**
     * Returns operations list.
     *
     * @param Member                   $member      Member entity
     * @param Account                  $account     Account entity
     * @param int                      $currentPage Page number
     * @param OperationSearchFormModel $formModel   OperationSearch form model
     */
    public function getList(Member $member, Account $account, int $currentPage = 1, OperationSearchFormModel $formModel = null): ?Pagerfanta
    {
        if ($account->getBank()->getMember() === $member) {
            return $this->operationRepository->getList($member, $account, $currentPage, $formModel);
        }

        return null;
    }

    /**
     * Returns operation form.
     *
     * @param Member    $member    Member entity
     * @param Operation $operation Operation entity
     * @param Account   $account   Account entity for new operation
     */
    public function getForm(Member $member, Operation $operation = null, Account $account = null): ?Form
    {
        $formModel = new OperationFormModel();

        if (null === $operation && null !== $account) {
            $formModel->account = $account;
        } elseif (null !== $operation) {
            if ($member !== $operation->getAccount()->getBank()->getMember()) {
                return null;
            }

            $formModel->operationId = $operation->getOperationId();
            $formModel->account = $operation->getAccount();
            $formModel->type = null !== $operation->getCredit() ? 'credit' : 'debit';
            $formModel->thirdParty = $operation->getThirdParty();
            $formModel->category = $operation->getCategory();
            $formModel->paymentMethod = $operation->getPaymentMethod();
            $formModel->valueDate = $operation->getValueDate();
            $formModel->notes = $operation->getNotes();
            $formModel->reconciled = $operation->isReconciled();
            $formModel->amount = null !== $operation->getCredit() ? $operation->getCredit() : $operation->getDebit();
            $formModel->transferAccount = $operation->getTransferAccount();
        }

        return $this->formFactory->create(OperationFormType::class, $formModel, ['account' => $formModel->account]);
    }

    /**
     * Saves operation.
     */
    public function save(Member $member, Operation $operation): bool
    {
        $errors = $this->validator->validate($operation);

        if (0 === count($errors)) {
            return $this->doSave($member, $operation);
        }

        return false;
    }

    /**
     * Saves operation form.
     */
    public function saveForm(Member $member, ?Operation $operation, Form $form): bool
    {
        if ($form->isValid()) {
            $formModel = $form->getData();

            if (null === $operation) {
                $operation = new Operation();
            }

            $operation->setOperationId($formModel->operationId);
            $operation->setTransferAccount($formModel->transferAccount);
            $operation->setThirdParty($formModel->thirdParty);
            $operation->setDebit('debit' === $formModel->type ? $formModel->amount : null);
            $operation->setCredit('credit' === $formModel->type ? $formModel->amount : null);
            $operation->setValueDate($formModel->valueDate);
            $operation->setReconciled($formModel->reconciled);
            $operation->setNotes($formModel->notes);
            $operation->setAccount($formModel->account);
            $operation->setCategory($formModel->category);
            $operation->setPaymentMethod($formModel->paymentMethod);

            return $this->doSave($member, $operation);
        }

        return false;
    }

    /**
     * Deletes operations.
     */
    public function delete(Member $member, array $operationsId): bool
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->em->find(Operation::class, $operationId);

                if (null !== $operation) {
                    if ($member === $operation->getAccount()->getBank()->getMember()) {
                        $this->em->remove($operation);
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
     * Reconciles operations.
     */
    public function reconcile(Member $member, array $operationsId): bool
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->em->find(Operation::class, $operationId);

                if (null !== $operation) {
                    if ($member === $operation->getAccount()->getBank()->getMember()) {
                        $operation->setReconciled(true);
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

    public function findThirdParties(Member $member, string $queryString = null): array
    {
        return $this->operationRepository->findThirdParties($member, $queryString);
    }

    /**
     * Saves multiple operations.
     *
     * @param Account  $account    Account entity
     * @param array    $operations Operations data
     * @param \Closure $func       Regularly called function
     */
    public function saveMulti(Account $account, array $operations, \Closure $func): bool
    {
        $error = false;

        $i = 0;
        foreach ($operations as $operationArray) {
            $operation = new Operation();
            $operation->setAccount($account);
            $operation->setThirdParty($operationArray['label']);
            $operation->setPaymentMethod(
                $this->em->find(PaymentMethod::class, $operationArray['payment_method_id'])
            );

            if (isset($operationArray['transaction_id'])) {
                $operation->setExternalOperationId($operationArray['transaction_id']);
            }

            if ('debit' === $operationArray['type']) {
                $operation->setDebit($operationArray['amount']);
            } else {
                $operation->setCredit($operationArray['amount']);
            }
            $operation->setValueDate(new \DateTime($operationArray['value_date']));

            $errors = $this->validator->validate($account);

            if (0 === count($errors)) {
                try {
                    $this->em->persist($operation);

                    ++$i;

                    if (0 === $i % 100) {
                        try {
                            $this->em->flush();

                            $func($account, $i);
                        } catch (\Exception $e) {
                            $this->logger->error($e->getMessage());
                            $error = true;

                            continue;
                        }
                    }
                } catch (\Exception $e) {
                    $this->logger->error($e->getMessage());
                    $error = true;

                    continue;
                }
            } else {
                $this->logger->error(
                    sprintf(
                        'Errors importing transaction "%s" [member %d]',
                        $operationArray['label'],
                        $account->getBank()->getMember()->getMemberId()
                    )
                );
                $error = true;

                continue;
            }
        }

        if ($i > 0) {
            try {
                $this->em->flush();
            } catch (\Exception $e) {
                $error = true;
            }

            $func($account, $i);
        }

        return !$error;
    }

    /**
     * Returns last salary operation.
     */
    public function getLastSalary(Member $member): ?Operation
    {
        $category = $this->em->find(Category::class, $this->categoriesId['salary']);
        if (!$category) {
            return null;
        }

        return $this->operationRepository->getLastFromCategory($member, $category);
    }

    /**
     * Returns last biggest expense since a specified date.
     */
    public function getLastBiggestExpense(Member $member, \DateTime $since): ?Operation
    {
        return $this->operationRepository->getLastBiggestExpense($member, $since);
    }

    /**
     * Saves operation.
     */
    protected function doSave(Member $member, Operation $operation): bool
    {
        if (null !== $operation->getOperationId()) {
            $oldOperation = $this->em->getUnitOfWork()->getOriginalEntityData($operation);

            if ($member !== $oldOperation['account']->getBank()->getMember()) {
                return false;
            }
        }

        if ($member === $operation->getAccount()->getBank()->getMember()) {
            if (!in_array(
                $operation->getPaymentMethod()->getPaymentMethodId(),
                [
                    PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER,
                    PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER,
                ],
                true
            )) {
                $operation->setTransferAccount(null);
            }

            $transferOperationBeforeSave = null;
            if (null !== $operation->getOperationId()) {
                $operationBeforeSave = $this->em->find(
                    Operation::class,
                    $operation->getOperationId()
                );

                if (null !== $operationBeforeSave->getTransferOperation()) {
                    $transferOperationBeforeSave = $operationBeforeSave->getTransferOperation();
                }
            }

            if (null !== $operation->getTransferAccount()) {
                // update transfer => transfer
                if (null !== $transferOperationBeforeSave) {
                    $transferOperation = $operation->getTransferOperation();

                // update check => transfer
                } else {
                    $transferOperation = new Operation();
                    $transferOperation->setScheduler($operation->getScheduler());
                    $transferOperation->setTransferOperation($operation);

                    $operation->setTransferOperation($transferOperation);
                }

                if (PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER === $operation->getPaymentMethod()->getPaymentMethodId()) {
                    $paymentMethod = $this->em->find(
                        PaymentMethod::class,
                        PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                    );
                } else {
                    $paymentMethod = $this->em->find(
                        PaymentMethod::class,
                        PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER
                    );
                }

                $transferOperation->setAccount($operation->getTransferAccount());
                $transferOperation->setTransferAccount($operation->getAccount());
                $transferOperation->setDebit($operation->getCredit());
                $transferOperation->setCredit($operation->getDebit());
                $transferOperation->setThirdParty($operation->getThirdParty());
                $transferOperation->setCategory($operation->getCategory());
                $transferOperation->setPaymentMethod($paymentMethod);
                $transferOperation->setValueDate($operation->getValueDate());
                $transferOperation->setNotes((string) $operation->getNotes());

                try {
                    $this->em->persist($transferOperation);
                } catch (\Exception $e) {
                    $this->logger->error($e->getMessage());

                    return false;
                }
            } else {
                // update transfer => check
                if (null !== $transferOperationBeforeSave) {
                    $operation->setTransferOperation(null);

                    try {
                        $this->em->flush();
                        $this->em->remove($transferOperationBeforeSave);
                    } catch (\Exception $e) {
                        $this->logger->error($e->getMessage());

                        return false;
                    }
                }
            }

            try {
                $this->em->persist($operation);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->error($e->getMessage());
            }
        }

        return false;
    }
}
