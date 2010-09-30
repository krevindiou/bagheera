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


/**
 * Bagheera form
 *
 * @category   Bagheera
 * @package    Bagheera_Form
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Bagheera_Form extends Zend_Form
{
    protected $_entity;

    protected $_myElementDecorators = array(
        'main' => array(
            'ViewHelper',
            array(
                'HtmlTag',
                array('tag' => 'p', 'class' => 'field')
            ),
            array(
                'Label',
                array(
                    'tag' => 'p',
                    'labelClass' => 'label',
                    'description' => array('tag' => 'span', 'class' => 'description')
                )
            ),
        ),
        'file' => array(
            'File',
            array(
                'HtmlTag',
                array('tag' => 'p', 'class' => 'field')
            ),
            array(
                'Label',
                array(
                    'tag' => 'p',
                    'labelClass' => 'label',
                    'description' => array('tag' => 'span', 'class' => 'description')
                )
            ),
        ),
        'button' => array(
            'ViewHelper',
            'Tooltip',
        ),
        'image' => array(
            'Tooltip',
            'Image',
        ),
        'hidden' => array(
            'ViewHelper',
        ),
        'captcha' => array(
            array(
                'HtmlTag',
                array('tag' => 'p', 'class' => 'field')
            ),
            array(
                'Label',
                array(
                    'tag' => 'p',
                    'labelClass' => 'label',
                    'description' => array('tag' => 'span', 'class' => 'description')
                )
            ),
        ),
    );

    public function init()
    {
        $this->setDisableLoadDefaultDecorators(true);

        $this->addDecorator('FormElements')
             ->addDecorator('Form')
             ->addDecorator('FormErrors');

        $this->addElementPrefixPath(
            'Bagheera_Validate', __DIR__ . '/Validate', 'validate'
        );

        $this->addElementPrefixPath(
            'Bagheera_Form_Decorator', __DIR__ . '/Form/Decorator', 'decorator'
        );
    }

    /**
     * @see Zend_Form::createElement
     */
    public function createElement($type, $name, $options = null)
    {
        $element = parent::createElement($type, $name, $options);

        $element->clearDecorators();

        if (!isset($options['decorators']) || empty($options['decorators'])) {
            if (in_array($type, array('button', 'submit', 'reset'))) {
                $options['decorators'] = $this->_myElementDecorators['button'];
            } elseif ('image' == $type) {
                $options['decorators'] = $this->_myElementDecorators['image'];
            } elseif ('file' == $type) {
                $options['decorators'] = $this->_myElementDecorators['file'];
            } elseif (in_array($type, array('hidden', 'hash'))) {
                $options['decorators'] = $this->_myElementDecorators['hidden'];
            } elseif ('captcha' == $type) {
                $options['decorators'] = $this->_myElementDecorators['captcha'];
            } else {
                $options['decorators'] = $this->_myElementDecorators['main'];
            }

            $element->setDecorators($options['decorators']);
        }

        if (!isset($options['id'])) {
            $element->setAttrib('id', $this->getName() . '-' . $name);
        }

        return $element;
    }

    public function getEntity()
    {
        return $this->_entity;
    }

    public function setEntity($entity)
    {
        $this->_entity = $entity;
    }
}
