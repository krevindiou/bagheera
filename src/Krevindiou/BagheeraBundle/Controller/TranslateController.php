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

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller,
    Symfony\Component\HttpFoundation\Response,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;

class TranslateController extends Controller
{
    /**
     * @Route("/translations.js")
     */
    public function listAction()
    {
        $translator = $this->get('translator');
        $translations = array(
            'confirm' => $translator->trans('confirm'),
            'payment_method_credit_card' => $translator->trans('payment_method_credit_card'),
            'payment_method_check' => $translator->trans('payment_method_check'),
            'payment_method_withdrawal' => $translator->trans('payment_method_withdrawal'),
            'payment_method_transfer' => $translator->trans('payment_method_transfer'),
            'payment_method_deposit' => $translator->trans('payment_method_deposit'),
            'report_period_grouping_all' => $translator->trans('report_period_grouping_all'),
        );

        $js = 'Bagheera.translations = ' . json_encode($translations);

        $response = new Response($js);
        $response->headers->set('Content-Type', 'application/javascript');

        return $response;
    }
}
