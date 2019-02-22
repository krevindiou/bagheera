<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Repository\AccountRepository;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints as Assert;

class SchedulerFormType extends AbstractType
{
    private $accountRepository;

    public function __construct(AccountRepository $accountRepository)
    {
        $this->accountRepository = $accountRepository;
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add(
                'type',
                ChoiceType::class,
                [
                    'label' => 'scheduler.type',
                    'mapped' => false,
                    'expanded' => true,
                    'required' => true,
                    'choices' => [
                        'scheduler.type_debit' => 'debit',
                        'scheduler.type_credit' => 'credit',
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
                    'label' => 'scheduler.third_party',
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
                    'label' => 'scheduler.category',
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
                    'label' => 'scheduler.payment_method',
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
                    'label' => 'scheduler.value_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'attr' => [
                        'class' => 'input-small calendar',
                    ],
                ]
            )
            ->add(
                'limitDate',
                DateType::class,
                [
                    'label' => 'scheduler.limit_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'required' => false,
                    'attr' => [
                        'class' => 'input-small calendar',
                    ],
                ]
            )
            ->add(
                'frequencyUnit',
                ChoiceType::class,
                [
                    'label' => 'scheduler.frequency_unit',
                    'choices' => [
                        'scheduler.frequency_unit_day' => 'day',
                        'scheduler.frequency_unit_week' => 'week',
                        'scheduler.frequency_unit_month' => 'month',
                        'scheduler.frequency_unit_year' => 'year',
                    ],
                    'attr' => [
                        'class' => 'input-small',
                    ],
                ]
            )
            ->add(
                'frequencyValue',
                null,
                [
                    'label' => 'scheduler.frequency_value',
                    'attr' => [
                        'class' => 'input-mini',
                    ],
                ]
            )
            ->add(
                'notes',
                null,
                [
                    'label' => 'scheduler.notes',
                    'attr' => [
                        'rows' => 5,
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'reconciled',
                null,
                [
                    'label' => 'scheduler.reconciled',
                    'required' => false,
                ]
            )
            ->add(
                'active',
                null,
                [
                    'label' => 'scheduler.active',
                    'required' => false,
                ]
            )
            ->add(
                'submit',
                SubmitType::class,
                [
                    'label' => 'scheduler.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
        ;

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event): void {
                $form = $event->getForm();
                $scheduler = $event->getData();

                $account = $scheduler->getAccount();

                $form
                    ->add(
                        'amount',
                        MoneyType::class,
                        [
                            'label' => 'scheduler.amount',
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
                            'label' => 'scheduler.transfer_account',
                            'required' => false,
                            'placeholder' => 'scheduler.external_account',
                            'class' => 'App:Account',
                            'choices' => $this->accountRepository->getTransferableAccounts($account),
                            'attr' => [
                                'class' => 'input-xlarge',
                            ],
                        ]
                    )
                ;

                $debit = $scheduler->getDebit();
                $credit = $scheduler->getCredit();

                if (null !== $debit) {
                    $form->get('type')->setData('debit');
                    $form->get('amount')->setData($debit);
                } elseif (null !== $credit) {
                    $form->get('type')->setData('credit');
                    $form->get('amount')->setData($credit);
                } else {
                    $form->get('type')->setData('debit');
                }
            }
        );

        $builder->addEventListener(
            FormEvents::POST_SUBMIT,
            function (FormEvent $event): void {
                $form = $event->getForm();
                $scheduler = $event->getData();

                $type = $form->get('type')->getData();
                $amount = $form->get('amount')->getData();

                if ('debit' === $type) {
                    $scheduler->setDebit($amount);
                    $scheduler->setCredit(null);
                } elseif ('credit' === $type) {
                    $scheduler->setDebit(null);
                    $scheduler->setCredit($amount);
                }
            }
        );
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(
            [
                'data_class' => 'App\Entity\Scheduler',
            ]
        );
    }

    public function getName()
    {
        return 'app_scheduler';
    }
}
