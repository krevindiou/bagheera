<?php

declare(strict_types=1);

namespace App\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\OptionsResolver\OptionsResolver;

class OperationSearchFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add(
                'type',
                ChoiceType::class,
                [
                    'label' => 'operation.type',
                    'expanded' => true,
                    'required' => true,
                    'choices' => [
                        'operation.type_debit' => 'debit',
                        'operation.type_credit' => 'credit',
                    ],
                ]
            )
            ->add(
                'thirdParty',
                null,
                [
                    'label' => 'operation.third_party',
                    'attr' => [
                        'class' => 'input-large',
                    ],
                ]
            )
            ->add(
                'categories',
                null,
                [
                    'label' => 'operation.category',
                    'required' => false,
                    'group_by' => 'type',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'paymentMethods',
                null,
                [
                    'label' => 'operation.payment_method',
                    'required' => false,
                    'group_by' => 'type',
                    'attr' => [
                        'class' => 'input-medium',
                    ],
                ]
            )
            ->add(
                'valueDateStart',
                DateType::class,
                [
                    'label' => 'operation.search_value_date_start',
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
                    'label' => 'operation.search_value_date_end',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'required' => false,
                    'attr' => [
                        'class' => 'input-small calendar',
                    ],
                ]
            )
            ->add(
                'notes',
                null,
                [
                    'label' => 'operation.notes',
                    'attr' => [
                        'class' => 'input-large',
                        'rows' => 5,
                    ],
                ]
            )
            ->add(
                'reconciled',
                ChoiceType::class,
                [
                    'label' => 'operation.reconciled',
                    'required' => false,
                    'placeholder' => 'operation.search_reconciled_both',
                    'choices' => [
                        'operation.search_only_reconciled' => 1,
                        'operation.search_only_not_reconciled' => 0,
                    ],
                ]
            )
            ->add(
                'search',
                SubmitType::class,
                [
                    'label' => 'operation.search_form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
            ->add(
                'clear',
                SubmitType::class,
                [
                    'label' => 'operation.search_form_clear_button',
                    'attr' => [
                        'class' => 'btn',
                    ],
                ]
            )
        ;

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event): void {
                $form = $event->getForm();
                $operationSearch = $event->getData();

                $account = $operationSearch->getAccount();

                $form
                    ->add(
                        'amount_comparator_1',
                        ChoiceType::class,
                        [
                            'mapped' => false,
                            'required' => false,
                            'placeholder' => '',
                            'choices' => [
                                '<' => 'inferiorTo',
                                '<=' => 'inferiorOrEqualTo',
                                '=' => 'equalTo',
                                '>=' => 'superiorOrEqualTo',
                                '>' => 'superiorTo',
                            ],
                            'attr' => [
                                'class' => 'input-mini',
                            ],
                        ]
                    )
                    ->add(
                        'amount_1',
                        MoneyType::class,
                        [
                            'label' => 'operation.amount',
                            'currency' => $account->getCurrency(),
                            'mapped' => false,
                            'attr' => [
                                'class' => 'input-small',
                            ],
                        ]
                    )
                    ->add(
                        'amount_comparator_2',
                        ChoiceType::class,
                        [
                            'mapped' => false,
                            'required' => false,
                            'placeholder' => '',
                            'choices' => [
                                '<' => 'inferiorTo',
                                '<=' => 'inferiorOrEqualTo',
                                '=' => 'equalTo',
                                '>=' => 'superiorOrEqualTo',
                                '>' => 'superiorTo',
                            ],
                            'attr' => [
                                'class' => 'input-mini',
                            ],
                        ]
                    )
                    ->add(
                        'amount_2',
                        MoneyType::class,
                        [
                            'label' => 'operation.amount',
                            'currency' => $account->getCurrency(),
                            'mapped' => false,
                            'attr' => [
                                'class' => 'input-small',
                            ],
                        ]
                    )
                ;

                $formValues = [];
                if (null !== $operationSearch->getAmountInferiorTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'inferiorTo',
                        'amount' => $operationSearch->getAmountInferiorTo(),
                    ];
                }
                if (null !== $operationSearch->getAmountInferiorOrEqualTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'inferiorOrEqualTo',
                        'amount' => $operationSearch->getAmountInferiorOrEqualTo(),
                    ];
                }
                if (null !== $operationSearch->getAmountEqualTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'equalTo',
                        'amount' => $operationSearch->getAmountEqualTo(),
                    ];
                }
                if (null !== $operationSearch->getAmountSuperiorOrEqualTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'superiorOrEqualTo',
                        'amount' => $operationSearch->getAmountSuperiorOrEqualTo(),
                    ];
                }
                if (null !== $operationSearch->getAmountSuperiorTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'superiorTo',
                        'amount' => $operationSearch->getAmountSuperiorTo(),
                    ];
                }

                if (isset($formValues[0])) {
                    $form->get('amount_comparator_1')->setData($formValues[0]['amount_comparator']);
                    $form->get('amount_1')->setData($formValues[0]['amount']);
                }

                if (isset($formValues[1])) {
                    $form->get('amount_comparator_2')->setData($formValues[1]['amount_comparator']);
                    $form->get('amount_2')->setData($formValues[1]['amount']);
                }
            }
        );
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(
            [
                'data_class' => 'App\Entity\OperationSearch',
            ]
        );
    }

    public function getName()
    {
        return 'app_operation_search';
    }
}
