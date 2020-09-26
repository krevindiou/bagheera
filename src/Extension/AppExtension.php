<?php

declare(strict_types=1);

namespace App\Extension;

use App\Service\BankService;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Twig\Extension\AbstractExtension;
use Twig\Extension\GlobalsInterface;
use Twig\TwigFilter;

class AppExtension extends AbstractExtension implements GlobalsInterface
{
    private $tokenStorage;
    private $bankService;

    public function __construct(
        TokenStorageInterface $tokenStorage,
        BankService $bankService
    ) {
        $this->tokenStorage = $tokenStorage;
        $this->bankService = $bankService;
    }

    public function getGlobals()
    {
        $banks = [];

        $token = $this->tokenStorage->getToken();

        if (null !== $token) {
            $member = $token->getUser();

            if (is_object($member)) {
                $banks = $this->bankService->getList($member);
            }
        }

        return [
            'global_banks' => $banks,
        ];
    }

    public function getFilters()
    {
        return [
            new TwigFilter('money', [$this, 'formatMoney']),
        ];
    }

    public function formatMoney($amount, $currency = null, $locale = null)
    {
        $locale = null !== $locale ? $locale : \Locale::getDefault();
        $formatter = \NumberFormatter::create($locale, \NumberFormatter::CURRENCY);

        return $formatter->formatCurrency($amount / 10000, $currency);
    }
}
