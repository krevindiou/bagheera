<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\DependencyInjection\Container;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\User;
use Krevindiou\BagheeraBundle\Entity\Account;
use Krevindiou\BagheeraBundle\Entity\OperationSearch;
use Krevindiou\BagheeraBundle\Form\OperationSearchForm;

/**
 * OperationSearch service
 *
 *
 * @DI\Service("bagheera.operation_search")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "operation_search"})
 */
class OperationSearchService
{
    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /** @DI\Inject("service_container") */
    public $container;

    /**
     * Returns operationSearch form
     *
     * @param  User            $user            User entity
     * @param  OperationSearch $operationSearch OperationSearch entity
     * @param  Account         $account         Account entity for new operationSearch
     * @return Form
     */
    public function getForm(User $user, OperationSearch $operationSearch = null, Account $account = null)
    {
        if (null === $operationSearch && null !== $account) {
            $operationSearch = new OperationSearch();
            $operationSearch->setAccount($account);
        } elseif (null !== $operationSearch && $user !== $operationSearch->getAccount()->getBank()->getUser()) {
            return;
        }

        return $this->formFactory->create(new OperationSearchForm(), $operationSearch);
    }

    /**
     * Gets operationSearch from session
     *
     * @param  Account         $account Account entity
     * @return OperationSearch
     */
    public function getSessionSearch(Account $account)
    {
        $sessionSearch = $this->container->get('request')->getSession()->get('search');

        if (is_array($sessionSearch) && isset($sessionSearch[$account->getAccountId()])) {
            $operationSearch = new OperationSearch();
            $operationSearch->setAccount($account);
            $operationSearch->setType($sessionSearch[$account->getAccountId()]['type']);
            $operationSearch->setThirdParty($sessionSearch[$account->getAccountId()]['thirdParty']);

            if (isset($sessionSearch[$account->getAccountId()]['categories'])) {
                $dql = 'SELECT c ';
                $dql.= 'FROM KrevindiouBagheeraBundle:Category c ';
                $dql.= 'WHERE c.categoryId IN (' . implode(', ', $sessionSearch[$account->getAccountId()]['categories']) . ') ';
                $query = $this->em->createQuery($dql);
                $categories = $query->getResult();
                $operationSearch->setCategories(new ArrayCollection($categories));
            }

            if (isset($sessionSearch[$account->getAccountId()]['paymentMethods'])) {
                $dql = 'SELECT p ';
                $dql.= 'FROM KrevindiouBagheeraBundle:PaymentMethod p ';
                $dql.= 'WHERE p.paymentMethodId IN (' . implode(', ', $sessionSearch[$account->getAccountId()]['paymentMethods']) . ') ';
                $query = $this->em->createQuery($dql);
                $paymentMethods = $query->getResult();
                $operationSearch->setPaymentMethods(new ArrayCollection($paymentMethods));
            }

            for ($i = 1; $i <= 2; $i++) {
                switch ($sessionSearch[$account->getAccountId()]['amount_comparator_' . $i]) {
                    case 'inferiorTo':
                        $operationSearch->setAmountInferiorTo(
                            $sessionSearch[$account->getAccountId()]['amount_' . $i]
                        );
                        break;

                    case 'inferiorOrEqualTo':
                        $operationSearch->setAmountInferiorOrEqualTo(
                            $sessionSearch[$account->getAccountId()]['amount_' . $i]
                        );
                        break;

                    case 'equalTo':
                        $operationSearch->setAmountEqualTo(
                            $sessionSearch[$account->getAccountId()]['amount_' . $i]
                        );
                        break;

                    case 'superiorOrEqualTo':
                        $operationSearch->setAmountSuperiorOrEqualTo(
                            $sessionSearch[$account->getAccountId()]['amount_' . $i]
                        );
                        break;

                    case 'superiorTo':
                        $operationSearch->setAmountSuperiorTo(
                            $sessionSearch[$account->getAccountId()]['amount_' . $i]
                        );
                        break;
                }
            }

            if ('' != $sessionSearch[$account->getAccountId()]['valueDateStart']) {
                $operationSearch->setValueDateStart(
                    new \DateTime($sessionSearch[$account->getAccountId()]['valueDateStart'])
                );
            }

            if ('' != $sessionSearch[$account->getAccountId()]['valueDateEnd']) {
                $operationSearch->setValueDateEnd(
                    new \DateTime($sessionSearch[$account->getAccountId()]['valueDateEnd'])
                );
            }

            $operationSearch->setNotes($sessionSearch[$account->getAccountId()]['notes']);
            $operationSearch->setIsReconciled($sessionSearch[$account->getAccountId()]['isReconciled']);

            return $operationSearch;
        }
    }

    /**
     * Sets operationSearch from session
     *
     * @param  Account $account Account entity
     * @param  array   $search  Search param
     * @return void
     */
    public function setSessionSearch(Account $account, array $search)
    {
        $sessionSearch = $this->container->get('request')->getSession()->get('search');

        $sessionSearch[$account->getAccountId()] = $search;

        $this->container->get('request')->getSession()->set('search', $sessionSearch);
    }

    /**
     * Clears operationSearch from session
     *
     * @param  Account $account Account entity
     * @return void
     */
    public function clearSessionSearch(Account $account)
    {
        $sessionSearch = $this->container->get('request')->getSession()->get('search');

        if (is_array($sessionSearch) && isset($sessionSearch[$account->getAccountId()])) {
            unset($sessionSearch[$account->getAccountId()]);
            $this->container->get('request')->getSession()->set('search', $sessionSearch);
        }
    }
}
