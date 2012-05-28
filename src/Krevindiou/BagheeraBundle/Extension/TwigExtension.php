<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
