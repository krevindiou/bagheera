<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Email;
use Krevindiou\BagheeraBundle\Constraint\FieldExists;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class MemberForgotPasswordFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'email',
                'email',
                [
                    'label' => 'member.email',
                    'constraints' => [
                        new NotBlank(),
                        new Email(),
                        new FieldExists('Krevindiou\BagheeraBundle\Entity\Member', 'email')
                    ],
                    'attr' => [
                        'class' => 'input-xlarge'
                    ]
                ]
            )
            ->add(
                'submit',
                'submit',
                [
                    'label' => 'member.forgot_password.submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary'
                    ]
                ]
            );
    }

    public function getName()
    {
        return 'member_forgot_password';
    }
}
