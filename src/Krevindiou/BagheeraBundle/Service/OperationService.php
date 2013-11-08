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
use Pagerfanta\Adapter\CallbackAdapter;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\Member;
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
     * @param  Member          $member          Member entity
     * @param  Account         $account         Account entity
     * @param  integer         $currentPage     Page number
     * @param  OperationSearch $operationSearch OperationSearch entity
     * @return Pagerfanta
     */
    public function getList(Member $member, Account $account, $currentPage = 1, OperationSearch $operationSearch = null)
    {
        if ($account->getBank()->getMember() == $member) {
            $params = array(
                ':account_id' => $account->getAccountId()
            );

            $sql = 'SELECT
                operation.operation_id,
                operation.external_operation_id AS external_operation_id,
                operation.third_party AS operation_third_party,
                operation.debit AS operation_debit,
                operation.credit AS operation_credit,
                operation.value_date AS operation_value_date,
                operation.is_reconciled AS operation_is_reconciled,
                operation.notes AS operation_notes,
                scheduler.scheduler_id AS scheduler_id,
                account.account_id AS account_id,
                account.name AS account_name,
                account.currency AS account_currency,
                transfer_account.account_id AS transfer_account_id,
                transfer_account.name AS transfer_account_name,
                transfer_operation.operation_id AS transfer_operation_id,
                category.category_id AS category_id,
                category.name AS category_name,
                payment_method.payment_method_id AS payment_method_id,
                payment_method.name AS payment_method_name
                ';
            $sql.= 'FROM operation ';
            $sql.= 'INNER JOIN account ON operation.account_id = account.account_id ';
            $sql.= 'LEFT JOIN scheduler ON operation.scheduler_id = scheduler.scheduler_id ';
            $sql.= 'LEFT JOIN account AS transfer_account ON operation.transfer_account_id = transfer_account.account_id ';
            $sql.= 'LEFT JOIN operation AS transfer_operation ON operation.transfer_operation_id = transfer_operation.operation_id ';
            $sql.= 'LEFT JOIN category ON operation.category_id = category.category_id ';
            $sql.= 'LEFT JOIN payment_method ON operation.payment_method_id = payment_method.payment_method_id ';
            $sql.= 'WHERE operation.account_id = :account_id ';

            if (null !== $operationSearch) {
                if ('' != $operationSearch->getThirdParty()) {
                    $sql.= 'AND operation.third_party LIKE :third_party ';
                    $params[':third_party'] = '%' . $operationSearch->getThirdParty() . '%';
                }
                if (0 != count($operationSearch->getCategories())) {
                    $categories = array_map(
                        function($value) {
                            return $value->getCategoryId();
                        },
                        $operationSearch->getCategories()->toArray()
                    );

                    $sql.= 'AND operation.category_id IN (' . implode(',', $categories) . ') ';
                }
                if (0 != count($operationSearch->getPaymentMethods())) {
                    $paymentMethods = array_map(
                        function($value) {
                            return $value->getPaymentMethodId();
                        },
                        $operationSearch->getPaymentMethods()->toArray()
                    );

                    $sql.= 'AND operation.payment_method_id IN (' . implode(',', $paymentMethods) . ') ';
                }
                if (null !== $operationSearch->getAmountInferiorTo()) {
                    $sql.= 'AND operation.' . $operationSearch->getType() . ' < :amount_inferior_to ';
                    $params[':amount_inferior_to'] = $operationSearch->getAmountInferiorTo();
                }
                if (null !== $operationSearch->getAmountInferiorOrEqualTo()) {
                    $sql.= 'AND operation.' . $operationSearch->getType() . ' <= :amount_inferior_or_equal_to ';
                    $params[':amount_inferior_or_equal_to'] = $operationSearch->getAmountInferiorOrEqualTo();
                }
                if (null !== $operationSearch->getAmountEqualTo()) {
                    $sql.= 'AND operation.' . $operationSearch->getType() . ' = :amount_equal_to ';
                    $params[':amount_equal_to'] = $operationSearch->getAmountEqualTo();
                }
                if (null !== $operationSearch->getAmountSuperiorOrEqualTo()) {
                    $sql.= 'AND operation.' . $operationSearch->getType() . ' >= :amount_superior_or_equal_to ';
                    $params[':amount_superior_or_equal_to'] = $operationSearch->getAmountSuperiorOrEqualTo();
                }
                if (null !== $operationSearch->getAmountSuperiorTo()) {
                    $sql.= 'AND operation.' . $operationSearch->getType() . ' > :amount_superior_to ';
                    $params[':amount_superior_to'] = $operationSearch->getAmountSuperiorTo();
                }
                if (null !== $operationSearch->getValueDateStart()) {
                    $sql.= 'AND operation.value_date >= :value_date_start ';
                    $params[':value_date_start'] = $operationSearch->getValueDateStart()->format(\DateTime::ISO8601);
                }
                if (null !== $operationSearch->getValueDateEnd()) {
                    $sql.= 'AND operation.value_date <= :value_date_end ';
                    $params[':value_date_end'] = $operationSearch->getValueDateEnd()->format(\DateTime::ISO8601);
                }
                if ('' != $operationSearch->getNotes()) {
                    $sql.= 'AND operation.notes LIKE :notes ';
                    $params[':notes'] = '%' . $operationSearch->getNotes() . '%';
                }
                if (null !== $operationSearch->isReconciled()) {
                    $sql.= 'AND operation.is_reconciled = :reconciled ';
                    $params[':reconciled'] = $operationSearch->isReconciled();
                }
            }

            $sql.= 'ORDER BY operation.value_date DESC ';

            $conn = $this->em->getConnection();

            $getNbResultsCallback = function() use ($sql, $conn, $params) {
                $start = strpos($sql, ' FROM ');
                $length = strpos($sql, ' ORDER BY ') - $start;

                $sqlCount = 'SELECT COUNT(*) AS total ';
                $sqlCount.= substr($sql, $start, $length);

                $stmt = $conn->prepare($sqlCount);
                $stmt->execute($params);

                return $stmt->fetchColumn();
            };

            $getSliceCallback = function($offset, $length) use ($sql, $conn, $params) {
                $sql.= 'LIMIT :length OFFSET :offset';

                $params[':length'] = $length;
                $params[':offset'] = $offset;

                $stmt = $conn->prepare($sql);
                $stmt->execute($params);

                $operations = array();

                foreach ($stmt->fetchAll() as $row) {
                    if (!isset($operations[$row['operation_id']])) {
                        $operations[$row['operation_id']] = array(
                            'operationId' => $row['operation_id'],
                            'scheduler' => array(
                                'schedulerId' => $row['scheduler_id'],
                            ),
                            'account' => array(
                                'accountId' => $row['account_id'],
                                'currency' => $row['account_currency'],
                                'name' => $row['account_name'],
                            ),
                            'transferAccount' => array(
                                'accountId' => $row['transfer_account_id'],
                                'name' => $row['transfer_account_name'],
                            ),
                            'transferOperation' => array(
                                'operationId' => $row['transfer_operation_id'],
                            ),
                            'category' => array(
                                'categoryId' => $row['category_id'],
                                'name' => $row['category_name'],
                            ),
                            'paymentMethod' => array(
                                'paymentMethodId' => $row['payment_method_id'],
                                'name' => $row['payment_method_name'],
                            ),
                            'externalOperationId' => $row['external_operation_id'],
                            'thirdParty' => $row['operation_third_party'],
                            'debit' => $row['operation_debit'],
                            'credit' => $row['operation_credit'],
                            'amount' => (0 != $row['operation_credit']) ? $row['operation_credit'] : -$row['operation_debit'],
                            'valueDate' => (null !== $row['operation_value_date']) ? new \DateTime($row['operation_value_date']) : null,
                            'reconciled' => $row['operation_is_reconciled'],
                            'notes' => $row['operation_notes'],
                        );
                    }
                }

                return $operations;
            };

            $adapter = new CallbackAdapter($getNbResultsCallback, $getSliceCallback);

            $pager = new Pagerfanta($adapter);
            $pager->setMaxPerPage(20);
            $pager->setCurrentPage($currentPage);

            return $pager;
        }
    }

    /**
     * Returns operation form
     *
     * @param  Member    $member    Member entity
     * @param  Operation $operation Operation entity
     * @param  Account   $account   Account entity for new operation
     * @return Form
     */
    public function getForm(Member $member, Operation $operation = null, Account $account = null)
    {
        if (null === $operation && null !== $account) {
            $operation = new Operation();
            $operation->setAccount($account);
        } elseif (null !== $operation && $member !== $operation->getAccount()->getBank()->getMember()) {
            return;
        }

        return $this->formFactory->create('operation_type', $operation);
    }

    /**
     * Saves operation
     *
     * @param  Member    $member    Member entity
     * @param  Operation $operation Operation entity
     * @return boolean
     */
    protected function doSave(Member $member, Operation $operation)
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
     * @param  Member    $member    Member entity
     * @param  Operation $operation Operation entity
     * @return boolean
     */
    public function save(Member $member, Operation $operation)
    {
        $errors = $this->validator->validate($operation);

        if (0 == count($errors)) {
            return $this->doSave($member, $operation);
        }

        return false;
    }

    /**
     * Saves operation form
     *
     * @param  Member  $member Member entity
     * @param  Form    $form   Operation form
     * @return boolean
     */
    public function saveForm(Member $member, Form $form)
    {
        if ($form->isValid()) {
            return $this->doSave($member, $form->getData());
        }

        return false;
    }

    /**
     * Deletes operations
     *
     * @param  Member  $member       Member entity
     * @param  array   $operationsId Operations id to delete
     * @return boolean
     */
    public function delete(Member $member, array $operationsId)
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->em->find('KrevindiouBagheeraBundle:Operation', $operationId);

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
     * Reconciles operations
     *
     * @param  Member  $member       Member entity
     * @param  array   $operationsId Operations id to reconcile
     * @return boolean
     */
    public function reconcile(Member $member, array $operationsId)
    {
        try {
            foreach ($operationsId as $operationId) {
                $operation = $this->em->find('KrevindiouBagheeraBundle:Operation', $operationId);

                if (null !== $operation) {
                    if ($member === $operation->getAccount()->getBank()->getMember()) {
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

    public function findThirdParties(Member $member, $queryString)
    {
        $sql = 'SELECT o2.third_party AS "thirdParty", o2.category_id AS "categoryId" ';
        $sql.= 'FROM ( ';
        $sql.= '    SELECT o.third_party, MAX(o.value_date) AS max_value_date ';
        $sql.= '    FROM operation o ';
        $sql.= '    INNER JOIN account a ON o.account_id = a.account_id ';
        $sql.= '    INNER JOIN bank b ON a.bank_id = b.bank_id ';
        $sql.= '    WHERE b.member_id = :member_id ';
        $sql.= '    AND o.third_party ILIKE :third_party ';
        $sql.= '    GROUP BY o.third_party ';
        $sql.= ') AS tmp ';
        $sql.= 'INNER JOIN operation o2 ON o2.third_party = tmp.third_party AND o2.value_date = tmp.max_value_date ';
        $sql.= 'GROUP BY o2.third_party, o2.category_id ';

        $stmt = $this->em->getConnection()->prepare($sql);
        $stmt->bindValue('member_id', $member->getMemberId());
        $stmt->bindValue('third_party', '%' . $queryString . '%');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Saves multiple operations
     *
     * @param  Member  $member     Member entity
     * @param  Account $account    Account entity
     * @param  array   $operations Operations data
     * @param  Closure $func       Regularly called function
     * @return boolean
     */
    public function saveMulti(Member $member, Account $account, array $operations, \Closure $func)
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
}
