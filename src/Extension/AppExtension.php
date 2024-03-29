<?php

declare(strict_types=1);

namespace App\Extension;

use App\Entity\Member;
use App\Service\BankService;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Twig\Extension\AbstractExtension;
use Twig\Extension\GlobalsInterface;
use Twig\TwigFilter;

class AppExtension extends AbstractExtension implements GlobalsInterface
{
    public function __construct(private TokenStorageInterface $tokenStorage, private BankService $bankService)
    {
    }

    public function getGlobals()
    {
        $banks = [];

        $token = $this->tokenStorage->getToken();

        if (null !== $token) {
            /** @var Member $member */
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
