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

class AccountControllerTest extends ControllerTestCase
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

    public function testListOk()
    {
        $this->_login();

        $this->request->setMethod('GET');
        $this->dispatch('/home');
        $this->assertQueryCount('input[type="checkbox"]', 5);
        $this->resetRequest();
        $this->resetResponse();

        $this->_logout();
    }

    public function testDeleteOk()
    {
      $this->_login();

      $this->request
           ->setMethod('POST')
           ->setPost(array(
              'delete' => 'Delete',
              'banksId' => array(),
              'accountsId' => array(1),
           ));
      $this->dispatch('/home');
      $this->assertRedirectTo('/home');
      $this->resetRequest();
      $this->resetResponse();

      $this->request->setMethod('GET');
      $this->dispatch('/home');
      $this->assertQueryCount('input[type="checkbox"]', 4);
      $this->resetRequest();
      $this->resetResponse();

      $this->_logout();
    }

    public function testShare()
    {
    }

    public function testSaveNotOk()
    {
      $this->_login();

      $this->request
           ->setMethod('POST')
           ->setPost(array(
              'accountId' => 1,
              'bankId' => 1,
              'name' => '',
              'initialBalance' => 123,
              'overdraftFacility' => 0,
              'details' => '',
           ));
      $this->dispatch('/account-1');
      $this->assertNotRedirect();
      $this->resetRequest();
      $this->resetResponse();

      $this->_logout();
    }

    public function testSaveOk()
    {
      $this->_login();

      $_FILES = array(
          'details' => array(
              'name' => '',
              'type' => '',
              'tmp_name' => '',
                'error' => '4',
                'size' => '0',
            )
        );

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                'accountId' => '',
                'bankId' => 1,
                'name' => 'Checking account #3',
                'initialBalance' => 99,
                'overdraftFacility' => 0,
                'details' => '',
             ));
        $this->dispatch('/new-account');
        $this->assertRedirectTo('/home');
        $this->resetRequest();
        $this->resetResponse();

        $this->request->setMethod('GET');
        $this->dispatch('/home');
        $this->assertQueryCount('input[type="checkbox"]', 6);
        $this->resetRequest();
        $this->resetResponse();

        $this->_logout();
    }
}
