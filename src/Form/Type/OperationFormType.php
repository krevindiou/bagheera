<?php

declare(strict_types=1);

namespace App\Form\Type;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\MoneyType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

class OperationFormType extends AbstractType
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add(
                'type',
                ChoiceType::class,
                [
                    'label' => 'operation.type',
                    'mapped' => false,
                    'expanded' => true,
                    'required' => true,
                    'choices' => [
                        'operation.type_debit' => 'debit',
                        'operation.type_credit' => 'credit',
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
                    'placeholder' => '',
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
                    'placeholder' => '',
                    'group_by' => 'type',
                    'attr' => [
                        'class' => 'input-medium',
                    ],
                ]
            )
            ->add(
                'valueDate',
                DateType::class,
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
                SubmitType::class,
                [
                    'label' => 'operation.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
            ->add(
                'saveCreate',
                SubmitType::class,
                [
                    'label' => 'operation.form_submit_create_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
        ;

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($builder): void {
                $form = $event->getForm();
                $operation = $event->getData();

                $account = $operation->getAccount();

                $form
                    ->add(
                        'amount',
                        MoneyType::class,
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
                        EntityType::class,
                        [
                            'label' => 'operation.transfer_account',
                            'required' => false,
                            'placeholder' => 'operation.external_account',
                            'class' => 'App:Account',
                            'choices' => $this->em->getRepository('App:Account')->getTransferableAccounts($account),
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
            function (FormEvent $event) use ($builder): void {
                $form = $event->getForm();
                $operation = $event->getData();

                $type = $form->get('type')->getData();
                $amount = $form->get('amount')->getData();

                if ('debit' === $type) {
                    $operation->setDebit($amount);
                    $operation->setCredit(0);
                } elseif ('credit' === $type) {
                    $operation->setDebit(0);
                    $operation->setCredit($amount);
                }
            }
        );
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(
            [
                'data_class' => 'App\Entity\Operation',
            ]
        );
    }

    public function getName()
    {
        return 'app_operation';
    }
}
