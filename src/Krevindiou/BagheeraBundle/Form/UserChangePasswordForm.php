<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Length;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class UserChangePasswordForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'password',
                'repeated',
                array(
                    'type' => 'password',
                    'first_options' => array('label' => 'user_password'),
                    'second_options' => array('label' => 'user_password_confirmation'),
                    'invalid_message' => 'user_password_fields_must_match',
                    'constraints' => array(
                        new NotBlank(),
                        new Length(array('min' => 8))
                    ),
                    'attr' => array(
                        'class' => 'input-medium'
                    )
                )
            )
        ;
    }

    public function getName()
    {
        return 'user_change_password_type';
    }
}