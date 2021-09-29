<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Form\Model\OperationSearchFormModel;
use App\Form\Type\OperationSearchFormType;
use App\Repository\CategoryRepository;
use App\Repository\PaymentMethodRepository;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\HttpFoundation\RequestStack;

class OperationSearchService
{
    public function __construct(private FormFactoryInterface $formFactory, private RequestStack $requestStack, private CategoryRepository $categoryRepository, private PaymentMethodRepository $paymentMethodRepository)
    {
    }

    /**
     * Returns operationSearch form.
     */
    public function getForm(Member $member, ?OperationSearchFormModel $formModel, Account $account = null): ?FormInterface
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
