<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Form\Model\OperationSearchFormModel;
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
     * @param Member                   $member    Member entity
     * @param OperationSearchFormModel $formModel OperationSearch form model
     * @param Account                  $account   Account entity for new operationSearch
     */
    public function getForm(Member $member, ?OperationSearchFormModel $formModel, Account $account = null): ?Form
    {
        if (null === $formModel && null !== $account) {
            $formModel = new OperationSearchFormModel();
        }

        return $this->formFactory->create(OperationSearchFormType::class, $formModel, ['account' => $account]);
    }

    /**
     * Gets operationSearch from session.
     */
    public function getSessionSearch(Account $account): ?OperationSearchFormModel
    {
        $search = $this->requestStack->getCurrentRequest()->getSession()->get('search');
        if (!isset($search[$account->getAccountId()])) {
            return null;
        }

        return $search[$account->getAccountId()];
    }

    /**
     * Sets operationSearch from session.
     */
    public function setSessionSearch(Account $account, OperationSearchFormModel $formModel): void
    {
        $sessionSearch = $this->requestStack->getCurrentRequest()->getSession()->get('search');

        $sessionSearch[$account->getAccountId()] = $formModel;

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
