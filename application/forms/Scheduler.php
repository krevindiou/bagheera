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

use Application\Services\User as UserService,
    Application\Services\Category as CategoryService,
    Application\Services\PaymentMethod as PaymentMethodService;

/**
 * Scheduler form
 *
 * @category   Application
 * @package    Application_Forms
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Scheduler extends \Application\Forms\Transaction
{
    private function _getFrequencyUnitsOptions()
    {
        $translator = $this->getTranslator();

        return array(
            'day' => $translator->translate('frequencyUnitDay'),
            'week' => $translator->translate('frequencyUnitWeek'),
            'month' => $translator->translate('frequencyUnitMonth'),
            'year' => $translator->translate('frequencyUnitYear')
        );
    }

    public function init()
    {
        parent::init();

        $nbElements = count($this);

        $this->setName('formScheduler');

        $this->removeElement('transactionId');

        $this->addElement('hidden', 'schedulerId', array(
            'required' => false,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'limitDate', array(
            'label' => 'schedulerLimitDate',
            'required' => false,
            'size' => 10,
            'maxlength' => 10,
            'order' => ++$nbElements,
            'filters' => array(),
            'validators' => array(
                array(
                    'validator' => 'Date',
                    'options' => array(
                        'format' => 'yyyy-MM-dd'
                    )
                )
            )
        ));

        $this->addElement('select', 'frequencyUnit', array(
            'label' => 'schedulerFrequencyUnit',
            'multiOptions' => array('' => '') + $this->_getFrequencyUnitsOptions(),
            'required' => true,
            'order' => ++$nbElements,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'frequencyValue', array(
            'label' => 'schedulerFrequencyValue',
            'required' => true,
            'size' => 3,
            'maxlength' => 2,
            'order' => ++$nbElements,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('radio', 'isActive', array(
            'label' => 'schedulerIsActive',
            'multiOptions' => array('1' => 'yes', '0' => 'no'),
            'separator' => '',
            'order' => ++$nbElements,
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->getElement('save')->setOrder(++$nbElements);
    }
}
