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
 * User form
 *
 *
 * @DI\FormType
 */
class UserRegisterForm extends AbstractType
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
                    'label' => 'user_email',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
            ->add(
                'country',
                'country',
                array(
                    'label' => 'user_country',
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
                    'first_name' => 'user_password',
                    'second_name' => 'user_password_confirmation',
                    'invalid_message' => 'user_password_fields_must_match',
                    'options' => array(
                        'attr' => array(
                            'class' => 'input-medium'
                        )
                    )
                )
            )
            ->add(
                'recaptcha',
                'ewz_recaptcha',
                array(
                    'label' => 'user_captcha',
                    'attr' => array(
                        'options' => array(
                            'theme' => 'clean'
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
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\User',
                'validation_groups' => array('Default', 'password', 'captcha')
            )
        );
    }

    public function getName()
    {
        return 'user_register_type';
    }
}
