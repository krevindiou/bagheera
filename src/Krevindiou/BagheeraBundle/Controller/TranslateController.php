<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Response;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;

class TranslateController extends Controller
{
    /**
     * @Route("/translations.js")
     */
    public function listAction()
    {
        $translator = $this->get('translator');
        $translations = array(
            'payment_method_credit_card' => $translator->trans('payment_method.credit_card'),
            'payment_method_check' => $translator->trans('payment_method.check'),
            'payment_method_withdrawal' => $translator->trans('payment_method.withdrawal'),
            'payment_method_transfer' => $translator->trans('payment_method.transfer'),
            'payment_method_deposit' => $translator->trans('payment_method.deposit'),
            'report_period_grouping_all' => $translator->trans('report.period_grouping_all'),
            'email_domain_suggest' => $translator->trans('email_domain_suggest'),
        );

        $js = 'Bagheera.translations = ' . json_encode($translations);

        $response = new Response($js);
        $response->headers->set('Content-Type', 'application/javascript');

        return $response;
    }
}
