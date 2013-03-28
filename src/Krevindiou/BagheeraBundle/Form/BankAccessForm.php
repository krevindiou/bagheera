<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * Bank access form
 *
 *
 * @DI\FormType
 */
class BankAccessForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'plainLogin',
                null,
                array(
                    'label' => 'bank_access_login',
                    'attr' => array(
                        'class' => 'input-large'
                    )
                )
            )
            ->add(
                'plainPassword',
                null,
                array(
                    'label' => 'bank_access_password',
                    'attr' => array(
                        'class' => 'input-large'
                    )
                )
            )
        ;
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\BankAccess'
            )
        );
    }

    public function getName()
    {
        return 'bank_access_type';
    }
}
