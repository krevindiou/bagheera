<?php

declare(strict_types=1);

namespace App\Form\Type;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CurrencyType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\OptionsResolver\OptionsResolver;

class AccountFormType extends AbstractType
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
                'name',
                null,
                [
                    'label' => 'account.name',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'submit',
                SubmitType::class,
                [
                    'label' => 'account.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
        ;

        $member = $options['member'];

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($member): void {
                $form = $event->getForm();
                $account = $event->getData();

                $edit = (null !== $account->getAccountId());

                $form
                    ->add(
                        'bank',
                        EntityType::class,
                        [
                            'label' => 'account.bank',
                            'placeholder' => '',
                            'class' => 'App:Bank',
                            'choices' => $this->em->getRepository('App:Bank')->getActiveBanks($member),
                            'disabled' => $edit,
                            'attr' => [
                                'class' => 'input-xlarge',
                            ],
                        ]
                    )
                    ->add(
                        'currency',
                        CurrencyType::class,
                        [
                            'label' => 'account.currency',
                            'disabled' => $edit,
                            'preferred_choices' => ['USD', 'EUR'],
                            'attr' => [
                                'class' => 'input-xlarge',
                            ],
                        ]
                    )
                    ->add(
                        'overdraftFacility',
                        MoneyType::class,
                        [
                            'label' => 'account.overdraft_facility',
                            'currency' => $account->getCurrency() ?: false,
                            'attr' => [
                                'class' => 'input-small',
                            ],
                        ]
                    )
                ;

                if (!$edit) {
                    $form
                        ->add(
                            'initialBalance',
                            MoneyType::class,
                            [
                                'label' => 'account.initial_balance',
                                'mapped' => false,
                                'required' => false,
                                'currency' => $account->getCurrency() ?: false,
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
        $resolver->setDefaults(
            [
                'data_class' => 'App\Entity\Account',
            ]
        );

        $resolver->setRequired(['member']);
    }

    public function getName()
    {
        return 'app_account';
    }
}
