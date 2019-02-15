<?php

declare(strict_types=1);

namespace App\Form\Type;

use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class MemberProfileFormType extends MemberRegisterFormType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        parent::buildForm($builder, $options);

        $builder->remove('plainPassword');
        $builder->remove('country');
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(
            [
                'data_class' => 'App\Entity\Member',
            ]
        );
    }

    public function getName()
    {
        return 'app_member_profile';
    }
}
