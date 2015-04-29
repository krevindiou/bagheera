<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
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
                'submit',
                [
                    'label' => 'bank_access.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'AppBundle\Entity\BankAccess',
            ]
        );
    }

    public function getName()
    {
        return 'bank_access';
    }
}
