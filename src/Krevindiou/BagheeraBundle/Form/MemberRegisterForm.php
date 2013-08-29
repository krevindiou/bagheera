<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use Symfony\Component\Locale\Locale;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class MemberRegisterForm extends AbstractType
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
                array(
                    'label' => 'member.email',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
            ->add(
                'country',
                'country',
                array(
                    'label' => 'member.country',
                    'preferred_choices' => array($preferredChoice),
                    'attr' => array(
                        'class' => 'input-large'
                    )
                )
            )
            ->add(
                'plainPassword',
                'repeated',
                array(
                    'type' => 'password',
                    'first_options' => array('label' => 'member.password'),
                    'second_options' => array('label' => 'member.password_confirmation'),
                    'invalid_message' => 'member.password_fields_must_match',
                    'options' => array(
                        'attr' => array(
                            'class' => 'input-medium'
                        )
                    )
                )
            )
        ;
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Member',
                'validation_groups' => array('Default', 'password')
            )
        );
    }

    public function getName()
    {
        return 'member_register_type';
    }
}
