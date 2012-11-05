<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Extension;

class TwigExtension extends \Twig_Extension
{
    public function getFilters()
    {
        return array(
            'var_dump' => new \Twig_Filter_Function('var_dump'),
            'abs' => new \Twig_Filter_Function('abs'),
            'money' => new \Twig_Filter_Method($this, 'moneyFilter'),
        );
    }

    public function moneyFilter($string, $currency = '')
    {
        return sprintf('%.2f %s', $string, $currency);
    }

    public function getName()
    {
        return 'bagheera_twig_extension';
    }
}
