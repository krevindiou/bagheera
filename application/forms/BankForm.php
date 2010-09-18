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
 * Bank form
 *
 * @category   Application
 * @package    Application_Forms
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankForm extends \Bagheera_Form
{
    public function init()
    {
        parent::init();

        $this->setMethod('post');

        $this->addElement('text', 'name', array(
            'label' => 'bankName',
            'required' => true,
            'maxlength' => 32,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('textarea', 'info', array(
            'label' => 'bankInfo',
            'required' => false,
            'cols' => 30,
            'rows' => 5,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('textarea', 'contact', array(
            'label' => 'bankContact',
            'required' => false,
            'cols' => 30,
            'rows' => 5,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('submit', 'save', array(
            'label' => 'save',
            'ignore' => true,
        ));
    }
}
