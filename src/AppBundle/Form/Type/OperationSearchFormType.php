<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class OperationSearchFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'type',
                'choice',
                [
                    'label' => 'operation.type',
                    'expanded' => true,
                    'required' => true,
                    'choices' => [
                        'debit' => 'operation.type_debit',
                        'credit' => 'operation.type_credit',
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
                'date',
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
                'date',
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
                'choice',
                [
                    'label' => 'operation.reconciled',
                    'required' => false,
                    'empty_value' => 'operation.search_reconciled_both',
                    'choices' => [
                        1 => 'operation.search_only_reconciled',
                        0 => 'operation.search_only_not_reconciled',
                    ],
                ]
            )
            ->add(
                'search',
                'submit',
                [
                    'label' => 'operation.search_form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
            ->add(
                'clear',
                'submit',
                [
                    'label' => 'operation.search_form_clear_button',
                    'attr' => [
                        'class' => 'btn',
                    ],
                ]
            );

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $operationSearch = $event->getData();

                $account = $operationSearch->getAccount();

                $form
                    ->add(
                        'amount_comparator_1',
                        'choice',
                        [
                            'mapped' => false,
                            'required' => false,
                            'empty_value' => '',
                            'choices' => [
                                'inferiorTo' => '<',
                                'inferiorOrEqualTo' => '<=',
                                'equalTo' => '=',
                                'superiorOrEqualTo' => '>=',
                                'superiorTo' => '>',
                            ],
                            'attr' => [
                                'class' => 'input-mini',
                            ],
                        ]
                    )
                    ->add(
                        'amount_1',
                        'money',
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
                        'choice',
                        [
                            'mapped' => false,
                            'required' => false,
                            'empty_value' => '',
                            'choices' => [
                                'inferiorTo' => '<',
                                'inferiorOrEqualTo' => '<=',
                                'equalTo' => '=',
                                'superiorOrEqualTo' => '>=',
                                'superiorTo' => '>',
                            ],
                            'attr' => [
                                'class' => 'input-mini',
                            ],
                        ]
                    )
                    ->add(
                        'amount_2',
                        'money',
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
                if ('' != $operationSearch->getAmountInferiorTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'inferiorTo',
                        'amount' => $operationSearch->getAmountInferiorTo(),
                    ];
                }
                if ('' != $operationSearch->getAmountInferiorOrEqualTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'inferiorOrEqualTo',
                        'amount' => $operationSearch->getAmountInferiorOrEqualTo(),
                    ];
                }
                if ('' != $operationSearch->getAmountEqualTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'equalTo',
                        'amount' => $operationSearch->getAmountEqualTo(),
                    ];
                }
                if ('' != $operationSearch->getAmountSuperiorOrEqualTo()) {
                    $formValues[] = [
                        'amount_comparator' => 'superiorOrEqualTo',
                        'amount' => $operationSearch->getAmountSuperiorOrEqualTo(),
                    ];
                }
                if ('' != $operationSearch->getAmountSuperiorTo()) {
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

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'AppBundle\Entity\OperationSearch',
            ]
        );
    }

    public function getName()
    {
        return 'operation_search';
    }
}
