<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Email;
use Krevindiou\BagheeraBundle\Constraint\FieldExists;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class UserForgotPasswordForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'email',
                'email',
                array(
                    'label' => 'user.email',
                    'constraints' => array(
                        new NotBlank(),
                        new Email(),
                        new FieldExists('Krevindiou\BagheeraBundle\Entity\User', 'email')
                    ),
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
        ;
    }

    public function getName()
    {
        return 'user_forgot_password_type';
    }
}
