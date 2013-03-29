<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class OperationSearchForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'type',
                'choice',
                array(
                    'label' => 'operation_type',
                    'expanded' => true,
                    'required' => false,
                    'choices' => array(
                        'debit' => 'operation_type_debit',
                        'credit' => 'operation_type_credit'
                    )
                )
            )
            ->add(
                'thirdParty',
                null,
                array(
                    'label' => 'operation_third_party',
                    'attr' => array(
                        'class' => 'input-large'
                    )
                )
            )
            ->add(
                'categories',
                null,
                array(
                    'label' => 'operation_category',
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
                    'label' => 'operation_payment_method',
                    'required' => false,
                    'group_by' => 'type',
                    'attr' => array(
                        'class' => 'input-medium'
                    )
                )
            )
            ->add(
                'valueDateStart',
                'date',
                array(
                    'label' => 'operation_search_value_date_start',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'required' => false,
                    'attr' => array(
                        'class' => 'input-small calendar'
                    )
                )
            )
            ->add(
                'valueDateEnd',
                'date',
                array(
                    'label' => 'operation_search_value_date_end',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'required' => false,
                    'attr' => array(
                        'class' => 'input-small calendar'
                    )
                )
            )
            ->add(
                'notes',
                null,
                array(
                    'label' => 'operation_notes',
                    'attr' => array(
                        'class' => 'input-large',
                        'rows' => 5
                    )
                )
            )
            ->add(
                'isReconciled',
                'choice',
                array(
                    'label' => 'operation_is_reconciled',
                    'required' => false,
                    'empty_value' => 'operation_search_reconciled_both',
                    'choices' => array(
                        1 => 'operation_search_only_reconciled',
                        0 => 'operation_search_only_not_reconciled',
                    )
                )
            )
        ;

        $builder->addEventListener(
            FormEvents::PRE_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $operationSearch = $event->getData();

                $account = $operationSearch->getAccount();

                $form
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'amount_comparator_1',
                            'choice',
                            null,
                            array(
                                'mapped' => false,
                                'required' => false,
                                'empty_value' => '',
                                'choices' => array(
                                    'inferiorTo' => '<',
                                    'inferiorOrEqualTo' => '<=',
                                    'equalTo' => '=',
                                    'superiorOrEqualTo' => '>=',
                                    'superiorTo' => '>',
                                ),
                                'attr' => array(
                                    'class' => 'input-mini'
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'amount_1',
                            'money',
                            null,
                            array(
                                'label' => 'operation_amount',
                                'currency' => $account->getCurrency(),
                                'mapped' => false,
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'amount_comparator_2',
                            'choice',
                            null,
                            array(
                                'mapped' => false,
                                'required' => false,
                                'empty_value' => '',
                                'choices' => array(
                                    'inferiorTo' => '<',
                                    'inferiorOrEqualTo' => '<=',
                                    'equalTo' => '=',
                                    'superiorOrEqualTo' => '>=',
                                    'superiorTo' => '>',
                                ),
                                'attr' => array(
                                    'class' => 'input-mini'
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'amount_2',
                            'money',
                            null,
                            array(
                                'label' => 'operation_amount',
                                'currency' => $account->getCurrency(),
                                'mapped' => false,
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                    )
                ;

                $formValues = array();
                if ('' != $operationSearch->getAmountInferiorTo()) {
                    $formValues[] = array(
                        'amount_comparator' => 'inferiorTo',
                        'amount' => $operationSearch->getAmountInferiorTo()
                    );
                }
                if ('' != $operationSearch->getAmountInferiorOrEqualTo()) {
                    $formValues[] = array(
                        'amount_comparator' => 'inferiorOrEqualTo',
                        'amount' => $operationSearch->getAmountInferiorOrEqualTo()
                    );
                }
                if ('' != $operationSearch->getAmountEqualTo()) {
                    $formValues[] = array(
                        'amount_comparator' => 'equalTo',
                        'amount' => $operationSearch->getAmountEqualTo()
                    );
                }
                if ('' != $operationSearch->getAmountSuperiorOrEqualTo()) {
                    $formValues[] = array(
                        'amount_comparator' => 'superiorOrEqualTo',
                        'amount' => $operationSearch->getAmountSuperiorOrEqualTo()
                    );
                }
                if ('' != $operationSearch->getAmountSuperiorTo()) {
                    $formValues[] = array(
                        'amount_comparator' => 'superiorTo',
                        'amount' => $operationSearch->getAmountSuperiorTo()
                    );
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
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\OperationSearch'
            )
        );
    }

    public function getName()
    {
        return 'operation_search_type';
    }
}
