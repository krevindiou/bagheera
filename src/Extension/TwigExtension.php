<?php

namespace App\Extension;

use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\Service("twig.extension.bagheera")
 * @DI\Tag("twig.extension")
 */
class TwigExtension extends \Twig_Extension
{
    /** @DI\Inject("security.token_storage") */
    public $tokenStorage;

    /** @DI\Inject("app.bank") */
    public $bankService;

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

    public function getName()
    {
        return 'bagheera_twig_extension';
    }
}
