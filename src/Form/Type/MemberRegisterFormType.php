<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Form\Model\MemberRegisterFormModel;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CountryType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\RepeatedType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Intl\Intl;
use Symfony\Component\OptionsResolver\OptionsResolver;

class MemberRegisterFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        // Fill the country field according to browser's locale
        $preferredChoice = 'US';

        if (isset($options['attr']['language'])) {
            $languageParts = explode('_', $options['attr']['language']);

            if (count($languageParts) > 1) {
                $country = $languageParts[1];

                $countries = Intl::getRegionBundle()->getCountryNames('en');
                if (isset($countries[$country])) {
                    $preferredChoice = $country;
                }
            }
        }

        $builder
            ->add(
                'email',
                EmailType::class,
                [
                    'label' => 'member.email',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'country',
                CountryType::class,
                [
                    'label' => 'member.country',
                    'preferred_choices' => [$preferredChoice],
                    'attr' => [
                        'class' => 'input-large',
                    ],
                ]
            )
            ->add(
                'plainPassword',
                RepeatedType::class,
                [
                    'type' => PasswordType::class,
                    'first_options' => ['label' => 'member.password'],
                    'second_options' => ['label' => 'member.password_confirmation'],
                    'invalid_message' => 'member.password_fields_must_match',
                    'options' => [
                        'attr' => [
                            'class' => 'input-medium',
                        ],
                    ],
                ]
            )
            ->add(
                'submit',
                SubmitType::class,
                [
                    'label' => 'member.register.submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(
            [
                'data_class' => MemberRegisterFormModel::class,
            ]
        );
    }

    public function getName()
    {
        return 'app_member_register';
    }
}
