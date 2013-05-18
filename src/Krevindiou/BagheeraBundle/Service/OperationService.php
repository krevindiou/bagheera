<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\Validator\Validator;
use Symfony\Bridge\Monolog\Logger;
use Pagerfanta\Pagerfanta;
use Pagerfanta\Adapter\DoctrineORMAdapter;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\User;
use Krevindiou\BagheeraBundle\Entity\Account;
use Krevindiou\BagheeraBundle\Entity\Operation;
use Krevindiou\BagheeraBundle\Entity\OperationSearch;
use Krevindiou\BagheeraBundle\Entity\PaymentMethod;

/**
 * @DI\Service("bagheera.operation")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "operation"})
 */
class OperationService
{
    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /** @DI\Inject */
    public $validator;

    /** @DI\Inject("bagheera.account_import") */
    public $accountImportService;

    /**
     * Returns operations list
     *
     * @param  User            $user            User entity
     * @param  Account         $account         Account entity
     * @param  integer         $currentPage     Page number
     * @param  OperationSearch $operationSearch OperationSearch entity
     * @return Pagerfanta
     */
    public function getList(User $user, Account $account, $currentPage = 1, OperationSearch $operationSearch = null)
    {
        if ($account->getBank()->getUser() == $user) {
            $adapter = new DoctrineORMAdapter(
                $this->em->getRepository('KrevindiouBagheeraBundle:Operation')->getQueryByAccount(
                    $account,
                    $operationSearch
                )
            );

            $pager = new Pagerfanta($adapter);
            $pager->setMaxPerPage(20);
            $pager->setCurrentPage($currentPage);

            return $pager;
        }
    }

    /**
     * Returns operation form
     *
     * @param  User      $user      User entity
     * @param  Operation $operation Operation entity
     * @param  Account   $account   Account entity for new operation
     * @return Form
     */
    public function getForm(User $user, Operation $operation = null, Account $account = null)
    {
        if (null === $operation && null !== $account) {
            $operation = new Operation();
            $operation->setAccount($account);
        } elseif (null !== $operation && $user !== $operation->getAccount()->getBank()->getUser()) {
            return;
        }

        return $this->formFactory->create('operation_type', $operation);
    }

    /**
     * Saves operation
     *
     * @param  User      $user      User entity
     * @param  Operation $operation Operation entity
     * @return boolean
     */
    protected function doSave(User $user, Operation $operation)
    {
        if (null !== $operation->getOperationId()) {
            $oldOperation = $this->em->getUnitOfWork()->getOriginalEntityData($operation);

            if ($user !== $oldOperation['account']->getBank()->getUser()) {
                return false;
            }
        }

        if ($user === $operation->getAccount()->getBank()->getUser()) {
            if (!in_array(
                $operation->getPaymentMethod()->getPaymentMethodId(),
                array(
                    PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER,
                    PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                )
            )) {
                $operation->setTransferAccount(null);
            }

            $transferOperationBeforeSave = null;
            if (null !== $operation->getOperationId()) {
                $operationBeforeSave = $this->em->find(
                    'KrevindiouBagheeraBundle:Operation',
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

                if (PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER == $operation->getPaymentMethod()->getPaymentMethodId()) {
                    $paymentMethod = $this->em->find(
                        'KrevindiouBagheeraBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                    );
                } else {
                    $paymentMethod = $this->em->find(
                        'KrevindiouBagheeraBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_DEBIT_TRANSFER
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
                $transferOperation->setNotes($operation->getNotes());

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

    /**
     * Saves operation
     *
     * @param  User      $user      User entity
     * @param  Operation $operation Operation entity
     * @return boolean
     */
    public function save(User $user, Operation $operation)
    {
        $errors = $this->validator->validate($operation);

        if (0 == count($errors)) {
            return $this->doSave($user, $operation);
        }

        return false;
    }

    /**
     * Saves operation form
     *
     * @param  User    $user User entity
     * @param  Form    $form Operation form
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
     * Deletes operations
     *
     * @param  User    $user         User entity
     * @param  array   $operationsId Operations id to delete
     * @return boolean
     */
    public function delete(User $user, array $operationsId)
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->em->find('KrevindiouBagheeraBundle:Operation', $operationId);

                if (null !== $operation) {
                    if ($user === $operation->getAccount()->getBank()->getUser()) {
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
     * Reconciles operations
     *
     * @param  User    $user         User entity
     * @param  array   $operationsId Operations id to reconcile
     * @return boolean
     */
    public function reconcile(User $user, array $operationsId)
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->em->find('KrevindiouBagheeraBundle:Operation', $operationId);

                if (null !== $operation) {
                    if ($user === $operation->getAccount()->getBank()->getUser()) {
                        $operation->setReconciled(true);
                        $this->em->persist($operation);
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

    public function findThirdParties(User $user, $queryString)
    {
        $sql = 'SELECT o2.third_party AS thirdParty, o2.category_id AS categoryId ';
        $sql.= 'FROM ( ';
        $sql.= '    SELECT o.third_party, MAX(o.value_date) AS max_value_date ';
        $sql.= '    FROM operation o ';
        $sql.= '    INNER JOIN account a ON o.account_id = a.account_id ';
        $sql.= '    INNER JOIN bank b ON a.bank_id = b.bank_id ';
        $sql.= '    WHERE b.user_id = :user_id ';
        $sql.= '    AND o.third_party LIKE :third_party ';
        $sql.= '    GROUP BY o.third_party ';
        $sql.= ') AS tmp ';
        $sql.= 'INNER JOIN operation o2 ON o2.third_party = tmp.third_party AND o2.value_date = tmp.max_value_date ';
        $sql.= 'GROUP BY tmp.third_party ';

        $stmt = $this->em->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $user->getUserId());
        $stmt->bindValue('third_party', '%' . $queryString . '%');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Saves multiple operations
     *
     * @param  User    $user       User entity
     * @param  Account $account    Account entity
     * @param  array   $operations Operations data
     * @param  Closure $func       Regularly called function
     * @return boolean
     */
    public function saveMulti(User $user, Account $account, array $operations, \Closure $func)
    {
        $error = false;

        $i = 0;
        foreach ($operations as $operationArray) {
            $operation = new Operation();
            $operation->setAccount($account);
            $operation->setThirdParty($operationArray['label']);
            $operation->setPaymentMethod(
                $this->em->find('KrevindiouBagheeraBundle:PaymentMethod', $operationArray['payment_method_id'])
            );

            if (isset($operationArray['transaction_id'])) {
                $operation->setExternalOperationId($operationArray['transaction_id']);
            }

            if ('debit' == $operationArray['type']) {
                $operation->setDebit($operationArray['amount']);
            } else {
                $operation->setCredit($operationArray['amount']);
            }
            $operation->setValueDate(new \DateTime($operationArray['value_date']));

            $errors = $this->validator->validate($account);

            if (0 == count($errors)) {
                try {
                    $this->em->persist($operation);

                    $i++;

                    if ($i % 100 == 0) {
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
                        'Errors importing transaction "%s" [user %d]',
                        $operationArray['label'],
                        $account->getBank()->getUser()->getUserId()
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
}
