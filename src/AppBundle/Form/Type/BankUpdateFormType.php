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
class BankUpdateFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'name',
                null,
                [
                    'label' => 'bank.name',
                    'attr' => [
                        'hasProvider' => (null !== $options['data']->getProvider()),
                        'bankId' => $options['data']->getBankId(),
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'submit',
                'submit',
                [
                    'label' => 'bank.form_submit_button',
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
                'data_class' => 'AppBundle\Entity\Bank',
            ]
        );
    }

    public function getName()
    {
        return 'bank_update';
    }
}
