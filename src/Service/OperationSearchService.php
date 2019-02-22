<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Entity\OperationSearch;
use App\Form\Type\OperationSearchFormType;
use App\Repository\CategoryRepository;
use App\Repository\PaymentMethodRepository;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\RequestStack;

class OperationSearchService
{
    private $formFactory;
    private $requestStack;
    private $categoryRepository;
    private $paymentMethodRepository;

    public function __construct(
        FormFactoryInterface $formFactory,
        RequestStack $requestStack,
        CategoryRepository $categoryRepository,
        PaymentMethodRepository $paymentMethodRepository
    ) {
        $this->formFactory = $formFactory;
        $this->requestStack = $requestStack;
        $this->categoryRepository = $categoryRepository;
        $this->paymentMethodRepository = $paymentMethodRepository;
    }

    /**
     * Returns operationSearch form.
     *
     * @param Member          $member          Member entity
     * @param OperationSearch $operationSearch OperationSearch entity
     * @param Account         $account         Account entity for new operationSearch
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
                $categories = $this->categoryRepository->getCategories($sessionSearch[$account->getAccountId()]['categories']);
                $operationSearch->setCategories($categories);
            }

            if (isset($sessionSearch[$account->getAccountId()]['paymentMethods'])) {
                $paymentMethods = $this->paymentMethodRepository->getPaymentMethods($sessionSearch[$account->getAccountId()]['paymentMethods']);
                $operationSearch->setPaymentMethods($paymentMethods);
            }

            for ($i = 1; $i <= 2; ++$i) {
                $amount = '' !== $sessionSearch[$account->getAccountId()]['amount_'.$i] ? (int) $sessionSearch[$account->getAccountId()]['amount_'.$i] : null;

                switch ($sessionSearch[$account->getAccountId()]['amount_comparator_'.$i]) {
                    case 'inferiorTo':
                        $operationSearch->setAmountInferiorTo($amount);

                        break;
                    case 'inferiorOrEqualTo':
                        $operationSearch->setAmountInferiorOrEqualTo($amount);

                        break;
                    case 'equalTo':
                        $operationSearch->setAmountEqualTo($amount);

                        break;
                    case 'superiorOrEqualTo':
                        $operationSearch->setAmountSuperiorOrEqualTo($amount);

                        break;
                    case 'superiorTo':
                        $operationSearch->setAmountSuperiorTo($amount);

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
     */
    public function setSessionSearch(Account $account, array $search): void
    {
        $sessionSearch = $this->requestStack->getCurrentRequest()->getSession()->get('search');

        $sessionSearch[$account->getAccountId()] = $search;

        $this->requestStack->getCurrentRequest()->getSession()->set('search', $sessionSearch);
    }

    /**
     * Clears operationSearch from session.
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
