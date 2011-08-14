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
 * User form
 *
 * @category   Application
 * @package    Application_Forms
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserRegister extends \Bagheera_Form
{
    public function init()
    {
        parent::init();

        $this->setMethod('post');
        $this->setName('formUser');

        $this->addElement('hidden', 'userId', array(
            'required' => false,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'firstname', array(
            'label' => 'userFirstname',
            'required' => true,
            'maxlength' => 64,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'lastname', array(
            'label' => 'userLastname',
            'required' => true,
            'maxlength' => 64,
            'filters' => array(),
            'validators' => array()
        ));

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

        $this->addElement('password', 'password', array(
            'label' => 'userPassword',
            'description' => 'userPasswordDescription',
            'required' => true,
            'maxlength' => 128,
            'filters' => array(),
            'validators' => array(
                array(
                    'validator' => 'StringLength',
                    'options' => array(
                        'min' => 4
                    )
                )
            )
        ));

        $this->addElement('password', 'passwordConfirmation', array(
            'label' => 'userPasswordConfirmation',
            'required' => true,
            'maxlength' => 128,
            'filters' => array(),
            'validators' => array(
                array(
                    'validator' => 'PasswordConfirmation',
                    'options' => array('password')
                )
            )
        ));

        $this->addElement('submit', 'save', array(
            'label' => 'userRegisterAction',
            'ignore' => true,
        ));
    }

    /**
     * {@inheritdoc}
     */
    public function isValid($data)
    {
        $translate = \Zend_Registry::get('Zend_Translate');
        $em = \Zend_Registry::get('em');

        $dql = 'SELECT u ';
        $dql.= 'FROM Application\\Models\\User u ';
        $dql.= 'WHERE u._email = :email ';
        if ('' != $data['userId']) {
            $dql.= 'AND u._userId != :userId ';
        }

        $query = $em->createQuery($dql);
        $query->setParameter('email', $data['email']);
        if ('' != $data['userId']) {
            $query->setParameter('userId', $data['userId']);
        }

        $isValid = parent::isValid($data);
        if ($isValid) {
            try {
                $query->getSingleResult();

                $this->addError($translate->translate('userEmailFound'));
                $isValid = false;
            } catch (\Doctrine\ORM\NoResultException $e) {
            }
        }

        return $isValid;
    }
}
