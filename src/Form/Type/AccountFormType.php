<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Entity\Bank;
use App\Form\Model\AccountFormModel;
use App\Repository\BankRepository;
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
    private $bankRepository;

    public function __construct(BankRepository $bankRepository)
    {
        $this->bankRepository = $bankRepository;
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

                $edit = (null !== $account->accountId);

                $form
                    ->add(
                        'bank',
                        EntityType::class,
                        [
                            'label' => 'account.bank',
                            'placeholder' => '',
                            'class' => Bank::class,
                            'choices' => $this->bankRepository->getActiveBanks($member),
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
                            'currency' => $account->currency ?: false,
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
                                'currency' => $account->currency ?: false,
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
        $resolver->setRequired(['member']);
        $resolver->setDefaults(
            [
                'data_class' => AccountFormModel::class,
            ]
        );
    }

    public function getName()
    {
        return 'app_account';
    }
}
