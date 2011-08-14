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

use Application\Services\User as UserService;

/**
 * Account form
 *
 * @category   Application
 * @package    Application_Forms
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Account extends \Bagheera_Form
{
    private function _getBanksOptions()
    {
        $userService = UserService::getInstance();
        $currentUser = $userService->getCurrentUser();
        $banks = $currentUser->getBanks();

        $banksOptions = array();
        foreach ($banks as $bank) {
            $banksOptions[$bank->getBankId()] = $bank->getName();
        }

        return $banksOptions;
    }

    private function _getDetailsFilename()
    {
        $filename = null;

        $details = $this->getElement('details');

        $fileInfo = $details->getTransferAdapter()->getFileInfo();

        if (isset($fileInfo['details']['name'])) {
            $filename = md5(uniqid(mt_rand(), true));

            $pathInfo = pathinfo($fileInfo['details']['name']);

            if (isset($pathInfo['extension'])) {
                $filename.= '.' . $pathInfo['extension'];
            }
        }

        return $filename;
    }

    public function init()
    {
        parent::init();

        $this->setMethod('post');
        $this->setName('formAccount');

        $this->addElement('hidden', 'accountId', array(
            'required' => false,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('select', 'bankId', array(
            'label' => 'accountBank',
            'multiOptions' => array('' => '') + $this->_getBanksOptions(),
            'required' => true,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'name', array(
            'label' => 'accountName',
            'required' => true,
            'size' => 30,
            'maxlength' => 32,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'initialBalance', array(
            'label' => 'accountInitialBalance',
            'required' => false,
            'size' => 10,
            'maxlength' => 10,
            'filters' => array(),
            'validators' => array()
        ));

        $this->addElement('text', 'overdraftFacility', array(
            'label' => 'accountOverdraftFacility',
            'required' => false,
            'size' => 10,
            'maxlength' => 10,
            'filters' => array(),
            'validators' => array()
        ));

        $this->setAttrib('enctype', 'multipart/form-data');
        $this->addElement('file', 'details', array(
            'label' => 'accountDetails',
            'description' => '(jpeg, png, gif, pdf)',
            'required' => false,
            'destination' => __DIR__ . '/../../data/bankDetails',
            'valueDisabled' => true,
            'validators' => array(
                array('Count', false, 1),
                array('Size', false, '1MB'),
                array('Extension', false, 'jpg,jpeg,png,gif,pdf'),
            )
        ));
        $adapter = $this->getElement('details')->getTransferAdapter();
        $adapter->addFilter('Rename', array('target' => $this->_getDetailsFilename(), 'overwrite' => false));

        $this->addElement('submit', 'save', array(
            'label' => 'saveAction',
            'ignore' => true,
        ));
    }
}
