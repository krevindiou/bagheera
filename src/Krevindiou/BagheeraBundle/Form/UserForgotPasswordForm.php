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
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Validator\Constraints\Collection;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\Email;
use Krevindiou\BagheeraBundle\Constraint\FieldExists;

/**
 * Forgot password form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserForgotPasswordForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add('email', 'email', array('label' => 'user_email'))
        ;
    }

    public function getDefaultOptions(array $options)
    {
        $collectionConstraint = new Collection(array(
            'email' => array(
                new NotBlank(),
                new Email(),
                new FieldExists('Krevindiou\BagheeraBundle\Entity\User', 'email')
            ),
        ));

        $options['validation_constraint'] = $collectionConstraint;

        return $options;
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_userforgotpasswordtype';
    }
}
