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
class MemberChangePasswordForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'password',
                'repeated',
                [
                    'type' => 'password',
                    'first_options' => ['label' => 'member.password'],
                    'second_options' => ['label' => 'member.password_confirmation'],
                    'invalid_message' => 'member.password_fields_must_match',
                    'constraints' => [
                        new NotBlank(),
                        new Length(['min' => 8])
                    ],
                    'attr' => [
                        'class' => 'input-medium'
                    ]
                ]
            )
        ;
    }

    public function getName()
    {
        return 'member_change_password_type';
    }
}
