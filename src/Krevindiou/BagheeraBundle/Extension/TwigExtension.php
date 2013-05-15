<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Extension;

use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\Service("twig.extension.bagheera")
 * @DI\Tag("twig.extension")
 */
class TwigExtension extends \Twig_Extension
{
    public function getFilters()
    {
        return array(
            'money' => new \Twig_Filter_Method($this, 'moneyFilter'),
            'localized_date' => new \Twig_Filter_Method($this, 'localizedDateFilter'),
        );
    }

    public function moneyFilter($value, $currency, $locale)
    {
        $fmt = new \NumberFormatter($locale, \NumberFormatter::CURRENCY);

        return $fmt->formatCurrency($value, $currency);
    }

    public function localizedDateFilter($date, $locale)
    {
        $formatter = new \IntlDateFormatter(
            $locale,
            \IntlDateFormatter::MEDIUM,
            \IntlDateFormatter::NONE
        );

        return $formatter->format((int) $date->format('U'));
    }

    public function getName()
    {
        return 'bagheera_twig_extension';
    }
}
