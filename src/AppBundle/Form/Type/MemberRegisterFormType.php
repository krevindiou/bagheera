<?php

namespace AppBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use Symfony\Component\Locale\Locale;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class MemberRegisterFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        // Fill the country field according to browser's locale
        $preferredChoice = 'US';

        if (isset($options['attr']['language'])) {
            $languageParts = explode('_', $options['attr']['language']);

            if (count($languageParts) > 1) {
                $country = $languageParts[1];

                $countries = Locale::getDisplayCountries('en');
                if (isset($countries[$country])) {
                    $preferredChoice = $country;
                }
            }
        }

        $builder
            ->add(
                'email',
                'email',
                [
                    'label' => 'member.email',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'country',
                'country',
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
                'repeated',
                [
                    'type' => 'password',
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
                'submit',
                [
                    'label' => 'member.register.submit_button',
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
                'data_class' => 'AppBundle\Entity\Member',
                'validation_groups' => ['Default', 'password'],
            ]
        );
    }

    public function getName()
    {
        return 'app_member_register';
    }
}
