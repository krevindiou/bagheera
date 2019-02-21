<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\OperationSearch;
use App\Entity\PaymentMethod;
use App\Form\Type\OperationFormType;
use Doctrine\ORM\EntityManagerInterface;
use Pagerfanta\Pagerfanta;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class OperationService
{
    private $logger;
    private $em;
    private $formFactory;
    private $validator;
    private $categoriesId;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        $categoriesId
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->categoriesId = $categoriesId;
    }

    /**
     * Returns operations list.
     *
     * @param Member          $member          Member entity
     * @param Account         $account         Account entity
     * @param int             $currentPage     Page number
     * @param OperationSearch $operationSearch OperationSearch entity
     */
    public function getList(Member $member, Account $account, int $currentPage = 1, OperationSearch $operationSearch = null): ?Pagerfanta
    {
        if ($account->getBank()->getMember() === $member) {
            return $this->em->getRepository('App:Operation')->getList($member, $account, $currentPage, $operationSearch);
        }
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
        if (null === $operation && null !== $account) {
            $operation = new Operation();
            $operation->setAccount($account);
        } elseif (null !== $operation && $member !== $operation->getAccount()->getBank()->getMember()) {
            return null;
        }

        return $this->formFactory->create(OperationFormType::class, $operation);
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
    public function saveForm(Member $member, Form $form): bool
    {
        if ($form->isValid()) {
            return $this->doSave($member, $form->getData());
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
                $operation = $this->em->find('App:Operation', $operationId);

                if (null !== $operation) {
                    if ($member === $operation->getAccount()->getBank()->getMember()) {
                        $this->em->remove($operation);
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
     * Reconciles operations.
     */
    public function reconcile(Member $member, array $operationsId): bool
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->em->find('App:Operation', $operationId);

                if (null !== $operation) {
                    if ($member === $operation->getAccount()->getBank()->getMember()) {
                        $operation->setReconciled(true);
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

    public function findThirdParties(Member $member, string $queryString = null): array
    {
        return $this->em->getRepository('App:Operation')->findThirdParties($member, $queryString);
    }

    /**
     * Saves multiple operations.
     *
     * @param Account  $account    Account entity
     * @param array    $operations Operations data
     * @param \Closure $func       Regularly called function
     *
     * @return bool
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
                $this->em->find('App:PaymentMethod', $operationArray['payment_method_id'])
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
                            $this->logger->err($e->getMessage());
                            $error = true;

                            continue;
                        }
                    }
                } catch (\Exception $e) {
                    $this->logger->err($e->getMessage());
                    $error = true;

                    continue;
                }
            } else {
                $this->logger->err(
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
        $category = $this->em->find('App:Category', $this->categoriesId['salary']);
        if (!$category) {
            return null;
        }

        return $this->em->getRepository('App:Operation')->getLastFromCategory($member, $category);
    }

    /**
     * Returns last biggest expense since a specified date.
     */
    public function getLastBiggestExpense(Member $member, \DateTime $since): ?Operation
    {
        return $this->em->getRepository('App:Operation')->getLastBiggestExpense($member, $since);
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
                    'App:Operation',
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
                        'App:PaymentMethod',
                        PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                    );
                } else {
                    $paymentMethod = $this->em->find(
                        'App:PaymentMethod',
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
                    $this->logger->err($e->getMessage());

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
                        $this->logger->err($e->getMessage());

                        return false;
                    }
                }
            }

            try {
                $this->em->persist($operation);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }
}
