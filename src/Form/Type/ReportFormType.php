<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Entity\Account;
use App\Entity\Member;
use App\Form\Model\ReportFormModel;
use App\Repository\AccountRepository;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class ReportFormType extends AbstractType
{
    public function __construct(private AccountRepository $accountRepository)
    {
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add(
                'title',
                TextType::class,
                [
                    'label' => 'report.title',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'homepage',
                CheckboxType::class,
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
            )
        ;

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($options): void {
                $form = $event->getForm();
                $report = $event->getData();

                $type = $report->type;

                if (in_array($type, ['sum', 'average', 'distribution'], true)) {
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
                            EntityType::class,
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
                            EntityType::class,
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
                                'class' => Account::class,
                                'choices' => $this->accountRepository->getActiveAccounts($options['member']),
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

                if (in_array($type, ['sum', 'average'], true)) {
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

                if (in_array($type, ['distribution'], true)) {
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
                            IntegerType::class,
                            [
                                'label' => 'report.significant_results_number',
                                'attr' => [
                                    'class' => 'input-mini',
                                ],
                            ]
                        )
                    ;
                }

                if (in_array($type, ['estimate'], true)) {
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
                                'placeholder' => '',
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

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setRequired('member');
        $resolver->setAllowedTypes('member', Member::class);
        $resolver->setDefaults(
            [
                'data_class' => ReportFormModel::class,
                'validation_groups' => fn (FormInterface $form) => ['Default', $form->getData()->type],
            ]
        );
    }

    public function getName()
    {
        return 'app_report';
    }
}
