<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilder;

/**
 * User form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserRegisterForm extends AbstractType
{
    public function buildForm(FormBuilder $builder, array $options)
    {
        $builder
            ->add('email', 'email', array('label' => 'user_email'))
            ->add('country', 'country', array(
                'label' => 'user_country',
                'preferred_choices' => array('FR')
            ))
            ->add('plainPassword', 'repeated', array(
                'type' => 'password',
                'first_name' => 'user_password',
                'second_name' => 'user_password_confirmation',
                'invalid_message' => 'user_password_fields_must_match',
            ))
            ->add(
                'recaptcha',
                'ewz_recaptcha',
                array(
                    'label' => 'user_captcha',
                    'attr' => array()
                )
            )
        ;
    }

    public function getDefaultOptions(array $options)
    {
        $options['data_class'] = 'Krevindiou\BagheeraBundle\Entity\User';
        $options['validation_groups'] = array('Default', 'password', 'captcha');

        return $options;
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_userregistertype';
    }
}
