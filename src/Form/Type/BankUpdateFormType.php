<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Form\Model\BankUpdateFormModel;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class BankUpdateFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add(
                'name',
                TextType::class,
                [
                    'label' => 'bank.name',
                    'attr' => [
                        'hasProvider' => $options['hasProvider'],
                        'bankId' => $options['bankId'],
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'submit',
                SubmitType::class,
                [
                    'label' => 'bank.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setRequired(['hasProvider', 'bankId']);
        $resolver->setAllowedTypes('hasProvider', 'bool');
        $resolver->setAllowedTypes('bankId', 'int');
        $resolver->setDefaults(
            [
                'data_class' => BankUpdateFormModel::class,
            ]
        );
    }

    public function getName()
    {
        return 'app_bank_update';
    }
}
