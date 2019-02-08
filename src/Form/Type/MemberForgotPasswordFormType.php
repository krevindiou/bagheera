<?php

namespace AppBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Email;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use AppBundle\Constraint\FieldExists;
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
                EmailType::class,
                [
                    'label' => 'member.email',
                    'constraints' => [
                        new NotBlank(),
                        new Email(),
                        new FieldExists('AppBundle:Member', 'email'),
                    ],
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'submit',
                SubmitType::class,
                [
                    'label' => 'member.forgot_password.submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            );
    }

    public function getName()
    {
        return 'app_member_forgot_password';
    }
}
