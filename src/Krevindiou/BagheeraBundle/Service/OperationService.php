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
    Pagerfanta\Pagerfanta,
    Pagerfanta\Adapter\DoctrineORMAdapter,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\Operation,
    Krevindiou\BagheeraBundle\Entity\OperationSearch,
    Krevindiou\BagheeraBundle\Entity\PaymentMethod,
    Krevindiou\BagheeraBundle\Form\OperationForm;

/**
 * Operation service
 *
 */
class OperationService
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
     * @var AccountImportService
     */
    protected $_accountImportService;

    public function __construct(
        Logger $logger,
        EntityManager $em,
        FormFactory $formFactory,
        Validator $validator,
        AccountImportService $accountImportService)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_accountImportService = $accountImportService;
    }

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
                $this->_em->getRepository('KrevindiouBagheeraBundle:Operation')->getQueryByAccount(
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

        return $this->_formFactory->create(new OperationForm(), $operation);
    }

    /**
     * Saves operation
     *
     * @param  User      $user      User entity
     * @param  Operation $operation Operation entity
     * @return boolean
     */
    protected function _save(User $user, Operation $operation)
    {
        if (null !== $operation->getOperationId()) {
            $oldOperation = $this->_em->getUnitOfWork()->getOriginalEntityData($operation);

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
                $operationBeforeSave = $this->_em->find(
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
                    $paymentMethod = $this->_em->find(
                        'KrevindiouBagheeraBundle:PaymentMethod', PaymentMethod::PAYMENT_METHOD_ID_CREDIT_TRANSFER
                    );
                } else {
                    $paymentMethod = $this->_em->find(
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
                    $this->_em->persist($transferOperation);
                } catch (\Exception $e) {
                    $this->_logger->err($e->getMessage());

                    return false;
                }
            } else {
                // update transfer => check
                if (null !== $transferOperationBeforeSave) {
                    $operation->setTransferOperation(null);

                    try {
                        $this->_em->flush();
                        $this->_em->remove($transferOperationBeforeSave);
                    } catch (\Exception $e) {
                        $this->_logger->err($e->getMessage());

                        return false;
                    }
                }
            }

            try {
                $this->_em->persist($operation);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
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
        $errors = $this->_validator->validate($operation);

        if (0 == count($errors)) {
            return $this->_save($user, $operation);
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
            return $this->_save($user, $form->getData());
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
                $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', $operationId);

                if (null !== $operation) {
                    if ($user === $operation->getAccount()->getBank()->getUser()) {
                        $this->_em->remove($operation);
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
                $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', $operationId);

                if (null !== $operation) {
                    if ($user === $operation->getAccount()->getBank()->getUser()) {
                        $operation->setIsReconciled(true);
                        $this->_em->persist($operation);
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

    public function findThirdParties(User $user, $queryString)
    {
        $dql = 'SELECT o.thirdParty ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'JOIN o.account a ';
        $dql.= 'JOIN a.bank b ';
        $dql.= 'WHERE b.user = :user ';
        $dql.= 'AND o.thirdParty LIKE :thirdParty ';
        $dql.= 'GROUP BY o.thirdParty ';
        $dql.= 'ORDER BY o.thirdParty ASC ';
        $query = $this->_em->createQuery($dql);
        $query->setMaxResults(10);
        $query->setParameter('user', $user);
        $query->setParameter('thirdParty', '%' . $queryString . '%');

        $result = $query->getScalarResult();

        $thirdParties = array();
        foreach ($result as $key => $value) {
            $thirdParties[] = $value['thirdParty'];
        }

        return $thirdParties;
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
                $this->_em->find('KrevindiouBagheeraBundle:PaymentMethod', $operationArray['payment_method_id'])
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

            $errors = $this->_validator->validate($account);

            if (0 == count($errors)) {
                try {
                    $this->_em->persist($operation);

                    $i++;

                    if ($i % 100 == 0) {
                        try {
                            $this->_em->flush();

                            $func($account, $i);
                        } catch (\Exception $e) {
                            $this->_logger->err($e->getMessage());
                            $error = true;
                            continue;
                        }
                    }
                } catch (\Exception $e) {
                    $this->_logger->err($e->getMessage());
                    $error = true;
                    continue;
                }
            } else {
                $this->_logger->err(
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
                $this->_em->flush();
            } catch (\Exception $e) {
                $error = true;
            }

            $func($account, $i);
        }

        return !$error;
    }
}
