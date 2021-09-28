<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\PaymentMethod;
use App\Form\Model\OperationSearchFormModel;
use App\Repository\CategoryRepository;
use App\Repository\PaymentMethodRepository;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class OperationSearchFormType extends AbstractType
{
    private CategoryRepository $categoryRepository;
    private PaymentMethodRepository $paymentMethodRepository;

    public function __construct(
        CategoryRepository $categoryRepository,
        PaymentMethodRepository $paymentMethodRepository
    ) {
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
                    'required' => true,
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
                        'class' => 'input-large',
                    ],
                ]
            )
            ->add(
                'categories',
                ChoiceType::class,
                [
                    'label' => 'operation.category',
                    'required' => false,
                    'multiple' => true,
                    'group_by' => 'type',
                    'choices' => $this->categoryRepository->getList(),
                    'choice_label' => 'name',
                    'choice_value' => fn (Category $category = null) => $category ? $category->getCategoryId() : '',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'paymentMethods',
                ChoiceType::class,
                [
                    'label' => 'operation.payment_method',
                    'required' => false,
                    'multiple' => true,
                    'group_by' => 'type',
                    'choices' => $this->paymentMethodRepository->getList(),
                    'choice_label' => 'name',
                    'choice_value' => fn (PaymentMethod $paymentMethod = null) => $paymentMethod ? $paymentMethod->getPaymentMethodId() : '',
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
                TextareaType::class,
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
            ->add(
                'amountComparator1',
                ChoiceType::class,
                [
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
                'amount1',
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
                'amountComparator2',
                ChoiceType::class,
                [
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
                'amount2',
                MoneyType::class,
                [
                    'label' => 'operation.amount',
                    'currency' => $options['account']->getCurrency(),
                    'attr' => [
                        'class' => 'input-small',
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
                'data_class' => OperationSearchFormModel::class,
            ]
        );
    }

    public function getName()
    {
        return 'app_operation_search';
    }
}
