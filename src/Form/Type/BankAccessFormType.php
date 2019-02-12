<?php

namespace App\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;

class BankAccessFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'plainLogin',
                null,
                [
                    'label' => 'bank_access.login',
                    'attr' => [
                        'class' => 'input-large',
                    ],
                ]
            )
            ->add(
                'plainPassword',
                null,
                [
                    'label' => 'bank_access.password',
                    'attr' => [
                        'class' => 'input-large',
                    ],
                ]
            )
            ->add(
                'submit',
                SubmitType::class,
                [
                    'label' => 'bank_access.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            );
    }

    public function configureOptions(OptionsResolver $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'App\Entity\BankAccess',
            ]
        );
    }

    public function getName()
    {
        return 'app_bank_access';
    }
}
