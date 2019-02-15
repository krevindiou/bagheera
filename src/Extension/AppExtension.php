<?php

declare(strict_types=1);

namespace App\Extension;

use App\Service\BankService;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Twig\Extension\AbstractExtension;

class AppExtension extends AbstractExtension implements \Twig_Extension_GlobalsInterface
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
}
