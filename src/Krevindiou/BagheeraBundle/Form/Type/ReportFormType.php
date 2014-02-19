<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class ReportFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'title',
                null,
                [
                    'label' => 'report.title',
                    'attr' => [
                        'class' => 'input-xlarge'
                    ]
                ]
            )
            ->add(
                'homepage',
                null,
                [
                    'label' => 'report.homepage',
                    'required' => false
                ]
            )
        ;

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $report = $event->getData();

                $member = $report->getMember();

                $type = $report->getType();

                if (in_array($type, ['sum', 'average', 'distribution'])) {
                    $form
                        ->add(
                            'valueDateStart',
                            'date',
                            [
                                'label' => 'report.value_date_start',
                                'widget' => 'single_text',
                                'format' => 'yyyy-MM-dd',
                                'required' => false,
                                'attr' => [
                                    'class' => 'input-small calendar'
                                ]
                            ]
                        )
                        ->add(
                            'valueDateEnd',
                            'date',
                            [
                                'label' => 'report.value_date_end',
                                'widget' => 'single_text',
                                'format' => 'yyyy-MM-dd',
                                'required' => false,
                                'attr' => [
                                    'class' => 'input-small calendar'
                                ]
                            ]
                        )
                        ->add(
                            'thirdParties',
                            'text',
                            [
                                'label' => 'report.third_parties',
                                'required' => false,
                                'attr' => [
                                    'class' => 'input-large'
                                ]
                            ]
                        )
                        /*
                        ->add(
                            'categories',
                            null,
                            array(
                                'label' => 'report.categories',
                                'empty_value' => '',
                                'required' => false,
                                'group_by' => 'type',
                                'attr' => array(
                                    'class' => 'input-xlarge'
                                )
                            )
                        )
                        ->add(
                            'paymentMethods',
                            null,
                            array(
                                'label' => 'report.payment_methods',
                                'empty_value' => '',
                                'required' => false,
                                'group_by' => 'type',
                                'attr' => array(
                                    'class' => 'input-medium'
                                )
                            )
                        )
                        */
                        ->add(
                            'accounts',
                            'entity',
                            [
                                'label' => 'report.accounts',
                                'class' => 'Krevindiou\BagheeraBundle\Entity\Account',
                                'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($member) {
                                    return $repository->createQueryBuilder('a')
                                        ->innerJoin('a.bank', 'b')
                                        ->where('b.member = :member')
                                        ->andWhere('b.deleted = false')
                                        ->andWhere('b.closed = false')
                                        ->andWhere('a.deleted = false')
                                        ->setParameter('member', $member)
                                        ->add('orderBy', 'b.name ASC, a.name ASC');
                                },
                                'empty_value' => '',
                                'required' => false,
                                'multiple' => true,
                                'attr' => [
                                    'class' => 'input-xlarge'
                                ]
                            ]
                        )
                        ->add(
                            'reconciledOnly',
                            'checkbox',
                            [
                                'label' => 'report.reconciled_only',
                                'required' => false
                            ]
                        )
                    ;
                }

                if (in_array($type, ['sum', 'average'])) {
                    $form
                        ->add(
                            'periodGrouping',
                            'choice',
                            [
                                'label' => 'report.period_grouping',
                                'choices' => [
                                    'month' => 'report.period_grouping_month',
                                    'quarter' => 'report.period_grouping_quarter',
                                    'year' => 'report.period_grouping_year',
                                    'all' => 'report.period_grouping_all'
                                ],
                                'empty_value' => '',
                                'attr' => [
                                    'class' => 'input-small'
                                ]
                            ]
                        )
                    ;
                }

                if (in_array($type, ['distribution'])) {
                    $form
                        ->add(
                            'dataGrouping',
                            'choice',
                            [
                                'label' => 'report.data_grouping',
                                'choices' => [
                                    'category' => 'report.data_grouping_category',
                                    'third_party' => 'report.data_grouping_third_party',
                                    'payment_method' => 'report.data_grouping_payment_method',
                                ],
                                'empty_value' => '',
                                'attr' => [
                                    'class' => 'input-small'
                                ]
                            ]
                        )
                        ->add(
                            'significantResultsNumber',
                            null,
                            [
                                'label' => 'report.significant_results_number',
                                'attr' => [
                                    'class' => 'input-mini'
                                ]
                            ]
                        )
                    ;
                }

                if (in_array($type, ['estimate'])) {
                    $form
                        ->add(
                            'monthExpenses',
                            'money',
                            [
                                'label' => 'report.month_expenses',
                                'currency' => false,
                                'attr' => [
                                    'class' => 'input-small'
                                ]
                            ]
                        )
                        ->add(
                            'monthIncomes',
                            'money',
                            [
                                'label' => 'report.month_incomes',
                                'currency' => false,
                                'attr' => [
                                    'class' => 'input-small'
                                ]
                            ]
                        )
                        ->add(
                            'estimateDurationValue',
                            'text',
                            [
                                'label' => 'report.estimate_duration_value',
                                'attr' => [
                                    'class' => 'input-mini'
                                ]
                            ]
                        )
                        ->add(
                            'estimateDurationUnit',
                            'choice',
                            [
                                'label' => 'report.estimate_duration_unit',
                                'choices' => [
                                    'month' => 'report.estimate_duration_unit_month',
                                    'year' => 'report.estimate_duration_unit_year',
                                ],
                                'empty_value' => '',
                                'attr' => [
                                    'class' => 'input-small'
                                ]
                            ]
                        )
                    ;
                }
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Report',
                'validation_groups' => function(FormInterface $form) {
                    return ['Default', $form->getData()->getType()];
                }
            ]
        );
    }

    public function getName()
    {
        return 'report_type';
    }
}
