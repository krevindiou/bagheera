<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

class TranslateController extends AbstractController
{
    #[Route(path: '/translations.js', defaults: ['_format' => 'js'])]
    public function list(TranslatorInterface $translator): Response
    {
        $translations = [
            'payment_method_initial_balance' => $translator->trans('payment_method.initial_balance'),
            'payment_method_credit_card' => $translator->trans('payment_method.credit_card'),
            'payment_method_check' => $translator->trans('payment_method.check'),
            'payment_method_cash_withdrawal' => $translator->trans('payment_method.cash_withdrawal'),
            'payment_method_direct_debit' => $translator->trans('payment_method.direct_debit'),
            'payment_method_transfer' => $translator->trans('payment_method.transfer'),
            'payment_method_deposit' => $translator->trans('payment_method.deposit'),
            'report_period_grouping_all' => $translator->trans('report.period_grouping_all'),
            'email_domain_suggest' => $translator->trans('email_domain_suggest'),
        ];
        $js = 'Bagheera.translations = '.json_encode($translations);

        return new Response($js);
    }
}
