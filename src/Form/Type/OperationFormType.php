<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\PaymentMethod;
use App\Form\Model\OperationFormModel;
use App\Repository\AccountRepository;
use App\Repository\CategoryRepository;
use App\Repository\PaymentMethodRepository;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class OperationFormType extends AbstractType
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
                    'label' => 'operation.type',
                    'expanded' => true,
                    'choices' => [
                        'operation.type_debit' => 'debit',
                        'operation.type_credit' => 'credit',
                    ],
                ]
            )
            ->add(
                'thirdParty',
                TextType::class,
                [
                    'label' => 'operation.third_party',
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
                    'label' => 'operation.amount',
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
                    'label' => 'operation.category',
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
                    'label' => 'operation.payment_method',
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
                    'label' => 'operation.transfer_account',
                    'required' => false,
                    'placeholder' => 'operation.external_account',
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
                TextareaType::class,
                [
                    'label' => 'operation.notes',
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
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setRequired('account');
        $resolver->setAllowedTypes('account', Account::class);
        $resolver->setDefaults(
            [
                'data_class' => OperationFormModel::class,
            ]
        );
    }

    public function getName()
    {
        return 'app_operation';
    }
}
