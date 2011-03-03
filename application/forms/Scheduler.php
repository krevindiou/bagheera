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
class Scheduler extends \Bagheera_Form
{
    private function _getCategoriesOptions()
    {
        $userService = UserService::getInstance();
        $categoryService = CategoryService::getInstance();
        $options = $categoryService->getList($userService->getCurrentUser());

        return $options;
    }

    private function _getPaymentMethodsOptions()
    {
        $paymentMethodService = PaymentMethodService::getInstance();
        $paymentMethods = $paymentMethodService->getPaymentMethods();

        $options = array();
        foreach ($paymentMethods as $paymentMethod) {
            $options[$paymentMethod->getType()][$paymentMethod->getPaymentMethodId()] = $paymentMethod->getName();
        }

        return $options;
    }

    private function _getTransferAccountsOptions()
    {
        $transferAccountsOptions = array();

        $userService = UserService::getInstance();
        $currentUser = $userService->getCurrentUser();

        foreach ($currentUser->getAccounts() as $account) {
            if ($this->getElement('accountId')->getValue() != $account->getAccountId()) {
                $transferAccountsOptions[$account->getAccountId()] = sprintf(
                    '%s - %s',
                    $account->getBank()->getName(),
                    $account->getName()
                );
            }
        }

        return $transferAccountsOptions;
    }

    private function _getFrequencyUnitsOptions()
    {
        $translator = $this->getTranslator();

        return array(
            'day' => $translator->translate('day'),
            'week' => $translator->translate('week'),
            'month' => $translator->translate('month'),
            'year' => $translator->translate('year')
        );
    }

    public function populate(array $values)
    {
        parent::populate($values);

        $translator = $this->getTranslator();

        $this->getElement('transferAccountId')->setMultiOptions(
            array('' => $translator->translate('externalAccount')) + $this->_getTransferAccountsOptions()
        );

        return $this;
    }

    public function init()
    {
        parent::init();

        $this->setMethod('post');
        $this->setName('formScheduler');

        $this->addElement('hidden', 'schedulerId', array(
            'required' => false,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('hidden', 'accountId', array(
            'required' => false,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('radio', 'debitCredit', array(
            'label' => 'schedulerDebitCredit',
            'multiOptions' => array('debit' => 'schedulerDebit', 'credit' => 'schedulerCredit'),
            'separator' => '',
            'value' => 'debit',
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'thirdParty', array(
            'label' => 'schedulerThirdParty',
            'required' => true,
            'maxlength' => 64,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'categoryId', array(
            'label' => 'schedulerCategory',
            'multiOptions' => array('' => '') + $this->_getCategoriesOptions(),
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'paymentMethodId', array(
            'label' => 'schedulerPaymentMethod',
            'multiOptions' => array('' => '') + $this->_getPaymentMethodsOptions(),
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'transferAccountId', array(
            'label' => 'schedulerTransferAccount',
            'multiOptions' => array(),
            'required' => false,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'valueDate', array(
            'label' => 'schedulerValueDate',
            'required' => true,
            'maxlength' => 10,
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

        $this->addElement('text', 'limitDate', array(
            'label' => 'schedulerLimitDate',
            'required' => false,
            'maxlength' => 10,
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

        $this->addElement('text', 'frequencyValue', array(
            'label' => 'schedulerFrequencyValue',
            'required' => true,
            'maxlength' => 2,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'frequencyUnit', array(
            'label' => 'schedulerFrequencyUnit',
            'multiOptions' => array('' => '') + $this->_getFrequencyUnitsOptions(),
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'amount', array(
            'label' => 'schedulerAmount',
            'required' => true,
            'maxlength' => 10,
            'filters' => array('amount'),
            'validators' => array()
        ));

        $this->addElement('textarea', 'notes', array(
            'label' => 'schedulerNotes',
            'required' => false,
            'cols' => 30,
            'rows' => 5,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('radio', 'isReconciled', array(
            'label' => 'schedulerIsReconciled',
            'multiOptions' => array('1' => 'yes', '0' => 'no'),
            'separator' => '',
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('radio', 'isActive', array(
            'label' => 'schedulerIsActive',
            'multiOptions' => array('1' => 'yes', '0' => 'no'),
            'separator' => '',
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('submit', 'save', array(
            'label' => 'save',
            'ignore' => true,
        ));
    }
}
