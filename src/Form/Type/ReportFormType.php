<?php

namespace App\Form\Type;

use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\MoneyType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;

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
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'homepage',
                null,
                [
                    'label' => 'report.homepage',
                    'required' => false,
                ]
            )
            ->add(
                'submit',
                SubmitType::class,
                [
                    'label' => 'report.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            );

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $report = $event->getData();

                $member = $report->getMember();

                $type = $report->getType();

                if (in_array($type, ['sum', 'average', 'distribution'])) {
                    $form
                        ->add(
                            'valueDateStart',
                            DateType::class,
                            [
                                'label' => 'report.value_date_start',
                                'widget' => 'single_text',
                                'format' => 'yyyy-MM-dd',
                                'required' => false,
                                'attr' => [
                                    'class' => 'input-small calendar',
                                ],
                            ]
                        )
                        ->add(
                            'valueDateEnd',
                            DateType::class,
                            [
                                'label' => 'report.value_date_end',
                                'widget' => 'single_text',
                                'format' => 'yyyy-MM-dd',
                                'required' => false,
                                'attr' => [
                                    'class' => 'input-small calendar',
                                ],
                            ]
                        )
                        ->add(
                            'thirdParties',
                            TextType::class,
                            [
                                'label' => 'report.third_parties',
                                'required' => false,
                                'attr' => [
                                    'class' => 'input-large',
                                ],
                            ]
                        )
                        /*
                        ->add(
                            'categories',
                            null,
                            [
                                'label' => 'report.categories',
                                'placeholder' => '',
                                'required' => false,
                                'group_by' => 'type',
                                'attr' => [
                                    'class' => 'input-xlarge'
                                ]
                            ]
                        )
                        ->add(
                            'paymentMethods',
                            null,
                            [
                                'label' => 'report.payment_methods',
                                'placeholder' => '',
                                'required' => false,
                                'group_by' => 'type',
                                'attr' => [
                                    'class' => 'input-medium'
                                ]
                            ]
                        )
                        */
                        ->add(
                            'accounts',
                            EntityType::class,
                            [
                                'label' => 'report.accounts',
                                'class' => 'App:Account',
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
                                'placeholder' => '',
                                'required' => false,
                                'multiple' => true,
                                'attr' => [
                                    'class' => 'input-xlarge',
                                ],
                            ]
                        )
                        ->add(
                            'reconciledOnly',
                            CheckboxType::class,
                            [
                                'label' => 'report.reconciled_only',
                                'required' => false,
                            ]
                        )
                    ;
                }

                if (in_array($type, ['sum', 'average'])) {
                    $form
                        ->add(
                            'periodGrouping',
                            ChoiceType::class,
                            [
                                'label' => 'report.period_grouping',
                                'choices' => [
                                    'report.period_grouping_month' => 'month',
                                    'report.period_grouping_quarter' => 'quarter',
                                    'report.period_grouping_year' => 'year',
                                    'report.period_grouping_all' => 'all',
                                ],
                                'placeholder' => '',
                                'attr' => [
                                    'class' => 'input-small',
                                ],
                            ]
                        )
                    ;
                }

                if (in_array($type, ['distribution'])) {
                    $form
                        ->add(
                            'dataGrouping',
                            ChoiceType::class,
                            [
                                'label' => 'report.data_grouping',
                                'choices' => [
                                    'report.data_grouping_category' => 'category',
                                    'report.data_grouping_third_party' => 'third_party',
                                    'report.data_grouping_payment_method' => 'payment_method',
                                ],
                                'placeholder' => '',
                                'attr' => [
                                    'class' => 'input-small',
                                ],
                            ]
                        )
                        ->add(
                            'significantResultsNumber',
                            null,
                            [
                                'label' => 'report.significant_results_number',
                                'attr' => [
                                    'class' => 'input-mini',
                                ],
                            ]
                        )
                    ;
                }

                if (in_array($type, ['estimate'])) {
                    $form
                        ->add(
                            'monthExpenses',
                            MoneyType::class,
                            [
                                'label' => 'report.month_expenses',
                                'currency' => false,
                                'attr' => [
                                    'class' => 'input-small',
                                ],
                            ]
                        )
                        ->add(
                            'monthIncomes',
                            MoneyType::class,
                            [
                                'label' => 'report.month_incomes',
                                'currency' => false,
                                'attr' => [
                                    'class' => 'input-small',
                                ],
                            ]
                        )
                        ->add(
                            'estimateDurationValue',
                            TextType::class,
                            [
                                'label' => 'report.estimate_duration_value',
                                'attr' => [
                                    'class' => 'input-mini',
                                ],
                            ]
                        )
                        ->add(
                            'estimateDurationUnit',
                            ChoiceType::class,
                            [
                                'label' => 'report.estimate_duration_unit',
                                'choices' => [
                                    'report.estimate_duration_unit_month' => 'month',
                                    'report.estimate_duration_unit_year' => 'year',
                                ],
                                'placeholderplaceholder' => '',
                                'attr' => [
                                    'class' => 'input-small',
                                ],
                            ]
                        )
                    ;
                }
            }
        );
    }

    public function configureOptions(OptionsResolver $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'App\Entity\Report',
                'validation_groups' => function (FormInterface $form) {
                    return ['Default', $form->getData()->getType()];
                },
            ]
        );
    }

    public function getName()
    {
        return 'app_report';
    }
}
