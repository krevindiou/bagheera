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

namespace Application\Forms;

/**
 * Forgot password form
 *
 * @category   Application
 * @package    Application_Forms
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserForgotPassword extends \Bagheera_Form
{
    public function init()
    {
        parent::init();

        $this->setMethod('post');
        $this->setName('formUserForgotPassword');

        $this->addElement('text', 'email', array(
            'label' => 'userEmail',
            'required' => true,
            'maxlength' => 128,
            'size' => 40,
            'filters' => array(),
            'validators' => array(
                array(
                    'validator' => 'EmailAddress',
                )
            )
        ));

        $this->addElement('submit', 'save', array(
            'label' => 'userSendResetPasswordAction',
            'ignore' => true,
        ));
    }
}
