<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Doctrine\Common\Collections\ArrayCollection,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\Validator\Validator,
    Symfony\Component\HttpFoundation\Request,
    Symfony\Component\DependencyInjection\Container,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\OperationSearch,
    Krevindiou\BagheeraBundle\Form\OperationSearchForm;

/**
 * OperationSearch service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationSearchService
{
    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var FormFactory
     */
    protected $_formFactory;

    /**
     * @var Container
     */
    protected $_container;


    public function __construct(EntityManager $em, FormFactory $formFactory, Container $container)
    {
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_container = $container;
    }

    /**
     * Returns operationSearch form
     *
     * @param  User $user                       User entity
     * @param  OperationSearch $operationSearch OperationSearch entity
     * @param  Account $account                 Account entity for new operationSearch
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

        $form = $this->_formFactory->create(
            new OperationSearchForm($account ? : $operationSearch->getAccount()),
            $operationSearch
        );

        return $form;
    }

    /**
     * Gets operationSearch from session
     *
     * @param  Account $account Account entity
     * @return OperationSearch
     */
    public function getSessionSearch(Account $account)
    {
        $sessionSearch = $this->_container->get('request')->getSession()->get('search');

        if (is_array($sessionSearch) && isset($sessionSearch[$account->getAccountId()])) {
            $operationSearch = new OperationSearch();
            $operationSearch->setAccount($account);
            $operationSearch->setType($sessionSearch[$account->getAccountId()]['type']);
            $operationSearch->setThirdParty($sessionSearch[$account->getAccountId()]['thirdParty']);

            if (isset($sessionSearch[$account->getAccountId()]['categories'])) {
                $dql = 'SELECT c ';
                $dql.= 'FROM KrevindiouBagheeraBundle:Category c ';
                $dql.= 'WHERE c.categoryId IN (' . implode(', ', $sessionSearch[$account->getAccountId()]['categories']) . ') ';
                $query = $this->_em->createQuery($dql);
                $categories = $query->getResult();
                $operationSearch->setCategories(new ArrayCollection($categories));
            }

            if (isset($sessionSearch[$account->getAccountId()]['paymentMethods'])) {
                $dql = 'SELECT p ';
                $dql.= 'FROM KrevindiouBagheeraBundle:PaymentMethod p ';
                $dql.= 'WHERE p.paymentMethodId IN (' . implode(', ', $sessionSearch[$account->getAccountId()]['paymentMethods']) . ') ';
                $query = $this->_em->createQuery($dql);
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
     * @param  array $search    Search param
     * @return void
     */
    public function setSessionSearch(Account $account, array $search)
    {
        $sessionSearch = $this->_container->get('request')->getSession()->get('search');

        $sessionSearch[$account->getAccountId()] = $search;

        $this->_container->get('request')->getSession()->set('search', $sessionSearch);
    }

    /**
     * Clears operationSearch from session
     *
     * @param  Account $account Account entity
     * @return void
     */
    public function clearSessionSearch(Account $account)
    {
        $sessionSearch = $this->_container->get('request')->getSession()->get('search');

        if (is_array($sessionSearch) && isset($sessionSearch[$account->getAccountId()])) {
            unset($sessionSearch[$account->getAccountId()]);
            $this->_container->get('request')->getSession()->set('search', $sessionSearch);
        }
    }
}