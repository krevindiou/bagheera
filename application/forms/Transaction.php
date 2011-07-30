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
 * Transaction form
 *
 * @category   Application
 * @package    Application_Forms
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Transaction extends \Bagheera_Form
{
    protected function _getCategoriesOptions()
    {
        $userService = UserService::getInstance();
        $categoryService = CategoryService::getInstance();
        $options = $categoryService->getList($userService->getCurrentUser());

        return $options;
    }

    protected function _getPaymentMethodsOptions()
    {
        $translator = $this->getTranslator();

        $paymentMethodService = PaymentMethodService::getInstance();
        $paymentMethods = $paymentMethodService->getPaymentMethods();

        $options = array();
        foreach ($paymentMethods as $paymentMethod) {
            $options[$paymentMethod->getType()][$paymentMethod->getPaymentMethodId()] = $translator->translate('paymentMethod' . ucfirst($paymentMethod->getName()));
        }

        return $options;
    }

    protected function _getTransferAccountsOptions()
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
        $this->setName('formTransaction');

        $this->addElement('hidden', 'transactionId', array(
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
            'label' => 'transactionDebitCredit',
            'multiOptions' => array('debit' => 'transactionDebit', 'credit' => 'transactionCredit'),
            'separator' => '',
            'value' => 'debit',
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'thirdParty', array(
            'label' => 'transactionThirdParty',
            'required' => true,
            'maxlength' => 64,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'categoryId', array(
            'label' => 'transactionCategory',
            'multiOptions' => array('' => '') + $this->_getCategoriesOptions(),
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'paymentMethodId', array(
            'label' => 'transactionPaymentMethod',
            'multiOptions' => array('' => '') + $this->_getPaymentMethodsOptions(),
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'transferAccountId', array(
            'label' => 'transactionTransferAccount',
            'multiOptions' => array(),
            'required' => false,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'valueDate', array(
            'label' => 'transactionValueDate',
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

        $this->addElement('text', 'amount', array(
            'label' => 'transactionAmount',
            'required' => true,
            'maxlength' => 10,
            'filters' => array('amount'),
            'validators' => array()
        ));

        $this->addElement('textarea', 'notes', array(
            'label' => 'transactionNotes',
            'required' => false,
            'cols' => 30,
            'rows' => 5,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('radio', 'isReconciled', array(
            'label' => 'transactionIsReconciled',
            'multiOptions' => array('1' => 'yes', '0' => 'no'),
            'separator' => '',
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('submit', 'save', array(
            'label' => 'saveAction',
            'ignore' => true,
        ));
    }

    public function __clone()
    {
        $entity = $this->getEntity();
        if (null !== $entity) {
            $clonedEntity = clone $entity;
            $this->setEntity($clonedEntity);
        }
    }
}
