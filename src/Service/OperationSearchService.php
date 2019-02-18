<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Entity\OperationSearch;
use App\Form\Type\OperationSearchFormType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\RequestStack;

class OperationSearchService
{
    private $em;
    private $formFactory;
    private $requestStack;

    public function __construct(
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        RequestStack $requestStack
    ) {
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->requestStack = $requestStack;
    }

    /**
     * Returns operationSearch form.
     *
     * @param Member          $member          Member entity
     * @param OperationSearch $operationSearch OperationSearch entity
     * @param Account         $account         Account entity for new operationSearch
     *
     * @return Form
     */
    public function getForm(Member $member, OperationSearch $operationSearch = null, Account $account = null): ?Form
    {
        if (null === $operationSearch && null !== $account) {
            $operationSearch = new OperationSearch();
            $operationSearch->setAccount($account);
        } elseif (null !== $operationSearch && $member !== $operationSearch->getAccount()->getBank()->getMember()) {
            return null;
        }

        return $this->formFactory->create(OperationSearchFormType::class, $operationSearch);
    }

    /**
     * Gets operationSearch from session.
     *
     * @param Account $account Account entity
     *
     * @return OperationSearch
     */
    public function getSessionSearch(Account $account): ?OperationSearch
    {
        $sessionSearch = $this->requestStack->getCurrentRequest()->getSession()->get('search');

        if (is_array($sessionSearch) && isset($sessionSearch[$account->getAccountId()])) {
            $operationSearch = new OperationSearch();
            $operationSearch->setAccount($account);
            $operationSearch->setType($sessionSearch[$account->getAccountId()]['type']);
            $operationSearch->setThirdParty($sessionSearch[$account->getAccountId()]['thirdParty']);

            if (isset($sessionSearch[$account->getAccountId()]['categories'])) {
                $categories = $this->em->getRepository('App:Category')->getCategories($sessionSearch[$account->getAccountId()]['categories']);
                $operationSearch->setCategories($categories);
            }

            if (isset($sessionSearch[$account->getAccountId()]['paymentMethods'])) {
                $paymentMethods = $this->em->getRepository('App:PaymentMethod')->getPaymentMethods($sessionSearch[$account->getAccountId()]['paymentMethods']);
                $operationSearch->setPaymentMethods($paymentMethods);
            }

            for ($i = 1; $i <= 2; ++$i) {
                switch ($sessionSearch[$account->getAccountId()]['amount_comparator_'.$i]) {
                    case 'inferiorTo':
                        $operationSearch->setAmountInferiorTo(
                            $sessionSearch[$account->getAccountId()]['amount_'.$i]
                        );

                        break;
                    case 'inferiorOrEqualTo':
                        $operationSearch->setAmountInferiorOrEqualTo(
                            $sessionSearch[$account->getAccountId()]['amount_'.$i]
                        );

                        break;
                    case 'equalTo':
                        $operationSearch->setAmountEqualTo(
                            $sessionSearch[$account->getAccountId()]['amount_'.$i]
                        );

                        break;
                    case 'superiorOrEqualTo':
                        $operationSearch->setAmountSuperiorOrEqualTo(
                            $sessionSearch[$account->getAccountId()]['amount_'.$i]
                        );

                        break;
                    case 'superiorTo':
                        $operationSearch->setAmountSuperiorTo(
                            $sessionSearch[$account->getAccountId()]['amount_'.$i]
                        );

                        break;
                }
            }

            if ('' !== $sessionSearch[$account->getAccountId()]['valueDateStart']) {
                $operationSearch->setValueDateStart(
                    new \DateTime($sessionSearch[$account->getAccountId()]['valueDateStart'])
                );
            }

            if ('' !== $sessionSearch[$account->getAccountId()]['valueDateEnd']) {
                $operationSearch->setValueDateEnd(
                    new \DateTime($sessionSearch[$account->getAccountId()]['valueDateEnd'])
                );
            }

            $operationSearch->setNotes($sessionSearch[$account->getAccountId()]['notes']);

            $isReconciled = null;
            if ('1' === $sessionSearch[$account->getAccountId()]['reconciled']) {
                $isReconciled = true;
            } elseif ('0' === $sessionSearch[$account->getAccountId()]['reconciled']) {
                $isReconciled = false;
            }
            $operationSearch->setReconciled($isReconciled);

            return $operationSearch;
        }

        return null;
    }

    /**
     * Sets operationSearch from session.
     *
     * @param Account $account Account entity
     * @param array   $search  Search param
     */
    public function setSessionSearch(Account $account, array $search): void
    {
        $sessionSearch = $this->requestStack->getCurrentRequest()->getSession()->get('search');

        $sessionSearch[$account->getAccountId()] = $search;

        $this->requestStack->getCurrentRequest()->getSession()->set('search', $sessionSearch);
    }

    /**
     * Clears operationSearch from session.
     *
     * @param Account $account Account entity
     */
    public function clearSessionSearch(Account $account): void
    {
        $sessionSearch = $this->requestStack->getCurrentRequest()->getSession()->get('search');

        if (is_array($sessionSearch) && isset($sessionSearch[$account->getAccountId()])) {
            unset($sessionSearch[$account->getAccountId()]);
            $this->requestStack->getCurrentRequest()->getSession()->set('search', $sessionSearch);
        }
    }
}
