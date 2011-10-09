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
use Krevindiou\BagheeraBundle\Form\UserRegisterForm;

/**
 * User form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserProfileForm extends UserRegisterForm
{
    protected $_noPassword;

    public function __construct($noPassword)
    {
        $this->_noPassword = $noPassword;
    }

    public function buildForm(FormBuilder $builder, array $options)
    {
        parent::buildForm($builder, $options);

        $builder->get('password')->setRequired(false);

        if ($this->_noPassword) {
            $builder->remove('password');
        }
    }

    public function getDefaultOptions(array $options)
    {
        return array(
            'data_class' => 'Krevindiou\BagheeraBundle\Entity\User',
            'validation_groups' => array('profile')
        );
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_userprofiletype';
    }
}