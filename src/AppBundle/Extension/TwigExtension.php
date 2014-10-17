<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Extension;

use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\Service("twig.extension.bagheera")
 * @DI\Tag("twig.extension")
 */
class TwigExtension extends \Twig_Extension
{
    /** @DI\Inject("security.context") */
    public $security;

    /** @DI\Inject("app.bank") */
    public $bankService;

    public function getFilters()
    {
        return [
            'money' => new \Twig_Filter_Method($this, 'moneyFilter')
        ];
    }

    public function moneyFilter($value, $currency, $locale = null)
    {
        if (null === $locale) {
            $locale = \Locale::getDefault();
        }

        $fmt = new \NumberFormatter($locale, \NumberFormatter::CURRENCY);

        return $fmt->formatCurrency($value, $currency);
    }

    public function getGlobals()
    {
        $banks = [];

        $token = $this->security->getToken();

        if (null !== $token) {
            $member = $token->getUser();

            if (is_object($member)) {
                $banks = $this->bankService->getList($member);
            }
        }

        return [
            'global_banks' => $banks
        ];
    }

    public function getName()
    {
        return 'bagheera_twig_extension';
    }
}
