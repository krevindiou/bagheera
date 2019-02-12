<?php

namespace App\Extension;

use Twig\Extension\AbstractExtension;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use App\Service\BankService;

class AppExtension extends AbstractExtension implements \Twig_Extension_GlobalsInterface
{
    private $tokenStorage;
    private $bankService;

    public function __construct(
        TokenStorageInterface $tokenStorage,
        BankService $bankService
    )
    {
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
