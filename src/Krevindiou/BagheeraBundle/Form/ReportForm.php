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

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilder;

/**
 * Report form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class ReportForm extends AbstractType
{
    public function buildForm(FormBuilder $builder, array $options)
    {
        $type = $options['data']->getType();
        $user = $options['data']->getUser();

        $builder
            ->add(
                'title',
                null,
                array(
                    'label' => 'report_title',
                    'attr' => array(
                        'size' => 40
                    )
                )
            )
            ->add(
                'homepage',
                null,
                array(
                    'label' => 'report_homepage',
                    'required' => false
                )
            )
        ;

        if (in_array($type, array('sum', 'average', 'distribution'))) {
            $builder
                ->add(
                    'valueDateStart',
                    null,
                    array(
                        'label' => 'report_value_date_start',
                        'widget' => 'single_text',
                        'format' => 'yyyy-MM-dd',
                        'attr' => array(
                            'size' => 12,
                            'class' => 'calendar'
                        )
                    )
                )
                ->add(
                    'valueDateEnd',
                    null,
                    array(
                        'label' => 'report_value_date_end',
                        'widget' => 'single_text',
                        'format' => 'yyyy-MM-dd',
                        'attr' => array(
                            'size' => 12,
                            'class' => 'calendar'
                        )
                    )
                )
                ->add(
                    'thirdParties',
                    null,
                    array(
                        'label' => 'report_third_parties',
                        'attr' => array(
                            'size' => 40
                        )
                    )
                )
                /*
                ->add(
                    'categories',
                    null,
                    array(
                        'label' => 'report_categories',
                        'property' => 'dropDownListLabel',
                        'empty_value' => '',
                        'required' => false
                    )
                )
                ->add(
                    'paymentMethods',
                    null,
                    array(
                        'label' => 'report_payment_methods',
                        'property' => 'dropDownListLabel',
                        'empty_value' => '',
                        'required' => false
                    )
                )
                */
                ->add(
                    'accounts',
                    null,
                    array(
                        'label' => 'report_accounts',
                        'class' => 'Krevindiou\BagheeraBundle\Entity\Account',
                        'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($user) {
                            return $repository->createQueryBuilder('a')
                                ->innerJoin('a.bank', 'b')
                                ->where('b.user = :user')
                                ->setParameter('user', $user)
                                ->add('orderBy', 'a.name ASC');
                        },
                        'empty_value' => '',
                        'required' => false
                    )
                )
                ->add(
                    'reconciledOnly',
                    null,
                    array(
                        'label' => 'report_reconciled_only'
                    )
                )
            ;
        }

        if (in_array($type, array('sum', 'average'))) {
            $builder
                ->add(
                    'periodGrouping',
                    'choice',
                    array(
                        'label' => 'report_period_grouping',
                        'choices' => array(
                            'week' => 'report_period_grouping_week',
                            'month' => 'report_period_grouping_month',
                            'quarter' => 'report_period_grouping_quarter',
                            'year' => 'report_period_grouping_year',
                            'all' => 'report_period_grouping_all'
                        ),
                        'empty_value' => ''
                    )
                )
            ;
        }

        if (in_array($type, array('distribution'))) {
            $builder
                ->add(
                    'dataGrouping',
                    'choice',
                    array(
                        'label' => 'report_data_grouping',
                        'choices' => array(
                            'category' => 'report_data_grouping_category',
                            'third_party' => 'report_data_grouping_third_party',
                            'payment_method' => 'report_data_grouping_payment_method',
                        ),
                        'empty_value' => ''
                    )
                )
                ->add(
                    'significantResultsNumber',
                    null,
                    array(
                        'label' => 'report_significant_results_number',
                        'attr' => array(
                            'size' => 5
                        )
                    )
                )
            ;
        }

        if (in_array($type, array('estimate'))) {
            $builder
                ->add(
                    'monthExpenses',
                    'money',
                    array(
                        'label' => 'report_month_expenses',
                        'currency' => false
                    )
                )
                ->add(
                    'monthIncomes',
                    'money',
                    array(
                        'label' => 'report_month_incomes',
                        'currency' => false
                    )
                )
                ->add(
                    'estimateDurationValue',
                    null,
                    array(
                        'label' => 'report_estimate_duration_value',
                        'attr' => array(
                            'size' => 5
                        )
                    )
                )
                ->add(
                    'estimateDurationUnit',
                    'choice',
                    array(
                        'label' => 'report_estimate_duration_unit',
                        'choices' => array(
                            'month' => 'report_estimate_duration_unit_month',
                            'year' => 'report_estimate_duration_unit_year',
                        ),
                        'empty_value' => ''
                    )
                )
            ;
        }
    }

    public function getDefaultOptions(array $options)
    {
        $options['data_class'] = 'Krevindiou\BagheeraBundle\Entity\Report';
        $options['validation_groups'] = array('Default', $options['data']->getType());

        return $options;
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_reporttype';
    }
}
