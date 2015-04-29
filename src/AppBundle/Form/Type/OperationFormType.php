<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class OperationFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'type',
                'choice',
                [
                    'label' => 'operation.type',
                    'mapped' => false,
                    'expanded' => true,
                    'required' => true,
                    'choices' => [
                        'debit' => 'operation.type_debit',
                        'credit' => 'operation.type_credit',
                    ],
                    'constraints' => [
                        new Assert\NotBlank(),
                    ],
                ]
            )
            ->add(
                'thirdParty',
                null,
                [
                    'label' => 'operation.third_party',
                    'attr' => [
                        'class' => 'input-xlarge',
                        'autocomplete' => 'off',
                    ],
                ]
            )
            ->add(
                'category',
                null,
                [
                    'label' => 'operation.category',
                    'empty_value' => '',
                    'required' => false,
                    'group_by' => 'type',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'paymentMethod',
                null,
                [
                    'label' => 'operation.payment_method',
                    'empty_value' => '',
                    'group_by' => 'type',
                    'attr' => [
                        'class' => 'input-medium',
                    ],
                ]
            )
            ->add(
                'valueDate',
                'date',
                [
                    'label' => 'operation.value_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
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
                        'class' => 'input-xlarge',
                        'rows' => 5,
                    ],
                ]
            )
            ->add(
                'reconciled',
                null,
                [
                    'label' => 'operation.reconciled',
                    'required' => false,
                ]
            )
            ->add(
                'save',
                'submit',
                [
                    'label' => 'operation.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
            ->add(
                'saveCreate',
                'submit',
                [
                    'label' => 'operation.form_submit_create_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            );

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $operation = $event->getData();

                $account = $operation->getAccount();

                $form
                    ->add(
                        'amount',
                        'money',
                        [
                            'label' => 'operation.amount',
                            'currency' => $account->getCurrency(),
                            'mapped' => false,
                            'constraints' => [
                                new Assert\NotBlank(),
                            ],
                            'attr' => [
                                'class' => 'input-small',
                            ],
                        ]
                    )
                    ->add(
                        'transferAccount',
                        'entity',
                        [
                            'label' => 'operation.transfer_account',
                            'required' => false,
                            'empty_value' => 'operation.external_account',
                            'class' => 'Model:Account',
                            'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($account) {
                                return $repository->createQueryBuilder('a')
                                    ->innerJoin('a.bank', 'b')
                                    ->where('b.member = :member')
                                    ->andWhere('a != :account')
                                    ->setParameter('member', $account->getBank()->getMember())
                                    ->setParameter('account', $account)
                                    ->add('orderBy', 'b.name ASC, a.name ASC');
                            },
                            'attr' => [
                                'class' => 'input-xlarge',
                            ],
                        ]
                    )
                ;

                $debit = $operation->getDebit();
                $credit = $operation->getCredit();

                if (0 != $debit) {
                    $form->get('type')->setData('debit');
                    $form->get('amount')->setData($debit);
                } elseif (0 != $credit) {
                    $form->get('type')->setData('credit');
                    $form->get('amount')->setData($credit);
                } else {
                    $form->get('type')->setData('debit');
                }
            }
        );

        $builder->addEventListener(
            FormEvents::POST_SUBMIT,
            function (FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $operation = $event->getData();

                $type = $form->get('type')->getData();
                $amount = $form->get('amount')->getData();

                if ('debit' == $type) {
                    $operation->setDebit($amount);
                    $operation->setCredit(0);
                } elseif ('credit' == $type) {
                    $operation->setDebit(0);
                    $operation->setCredit($amount);
                }
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'AppBundle\Entity\Operation',
            ]
        );
    }

    public function getName()
    {
        return 'operation';
    }
}
