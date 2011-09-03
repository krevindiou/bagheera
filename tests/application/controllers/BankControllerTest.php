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

require_once __DIR__ . '/../../ControllerTestCase.php';

class BankControllerTest extends ControllerTestCase
{
    private function _login()
    {
        $adapter = new Bagheera_Auth_Adapter_Database('john@example.net', 'goodpassword');
        $auth = Zend_Auth::getInstance();
        $auth->authenticate($adapter);
    }

    private function _logout()
    {
        Zend_Auth::getInstance()->clearIdentity();
    }

    public function testSaveNotOk()
    {
        $this->_login();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'bankId' => 1,
                 'name' => '',
                 'info' => '',
                 'contact' => '',
             ));
        $this->dispatch('/bank-1');
        $this->assertNotRedirect();
        $this->assertQuery('ul.form-errors');

        $this->_logout();
    }

    public function testSaveOk()
    {
        $this->_login();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'bankId' => 1,
                 'name' => 'HSBC',
                 'info' => '',
                 'contact' => '',
             ));
        $this->dispatch('/bank-1');
        $this->assertRedirectTo('/home');

        $this->_logout();
    }
}
