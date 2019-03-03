<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\PaymentMethod;
use App\Form\Model\SchedulerFormModel;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Repository\PaymentMethodRepository;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class SchedulerFormType extends AbstractType
{
    private $accountRepository;
    private $categoryRepository;
    private $paymentMethodRepository;

    public function __construct(
        AccountRepository $accountRepository,
        CategoryRepository $categoryRepository,
        PaymentMethodRepository $paymentMethodRepository
    ) {
        $this->accountRepository = $accountRepository;
        $this->categoryRepository = $categoryRepository;
        $this->paymentMethodRepository = $paymentMethodRepository;
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add(
                'type',
                ChoiceType::class,
                [
                    'label' => 'scheduler.type',
                    'expanded' => true,
                    'choices' => [
                        'scheduler.type_debit' => 'debit',
                        'scheduler.type_credit' => 'credit',
                    ],
                ]
            )
            ->add(
                'thirdParty',
                TextType::class,
                [
                    'label' => 'scheduler.third_party',
                    'attr' => [
                        'class' => 'input-xlarge',
                        'autocomplete' => 'off',
                    ],
                ]
            )
            ->add(
                'amount',
                MoneyType::class,
                [
                    'label' => 'scheduler.amount',
                    'currency' => $options['account']->getCurrency(),
                    'attr' => [
                        'class' => 'input-small',
                    ],
                ]
            )
            ->add(
                'category',
                EntityType::class,
                [
                    'label' => 'scheduler.category',
                    'placeholder' => '',
                    'required' => false,
                    'group_by' => 'type',
                    'class' => Category::class,
                    'choices' => $this->categoryRepository->getList(),
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'paymentMethod',
                EntityType::class,
                [
                    'label' => 'scheduler.payment_method',
                    'placeholder' => '',
                    'group_by' => 'type',
                    'class' => PaymentMethod::class,
                    'choices' => $this->paymentMethodRepository->getList(),
                    'attr' => [
                        'class' => 'input-medium',
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
                    'class' => Account::class,
                    'choices' => $this->accountRepository->getTransferableAccounts($options['account']),
                    'attr' => [
                        'class' => 'input-xlarge',
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
                    'required' => false,
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
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
                IntegerType::class,
                [
                    'label' => 'scheduler.frequency_value',
                    'attr' => [
                        'class' => 'input-mini',
                    ],
                ]
            )
            ->add(
                'notes',
                TextareaType::class,
                [
                    'label' => 'scheduler.notes',
                    'required' => false,
                    'attr' => [
                        'class' => 'input-xlarge',
                        'rows' => 5,
                    ],
                ]
            )
            ->add(
                'reconciled',
                CheckboxType::class,
                [
                    'label' => 'scheduler.reconciled',
                    'required' => false,
                ]
            )
            ->add(
                'active',
                CheckboxType::class,
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
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setRequired('account');
        $resolver->setAllowedTypes('account', Account::class);
        $resolver->setDefaults(
            [
                'data_class' => SchedulerFormModel::class,
            ]
        );
    }

    public function getName()
    {
        return 'app_scheduler';
    }
}
