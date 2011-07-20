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

class UserControllerTest extends ControllerTestCase
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

    public function testLoginNotOk()
    {
        $this->request->setMethod('GET');
        $this->dispatch('/login');
        $this->assertQuery('#formUserLogin');
        $this->resetRequest();
        $this->resetResponse();

        $this->request
             ->setMethod('POST')
             ->setPost(
                array(
                 'email' => 'john@example.net',
                 'password' => 'badpassword'
                )
             );

        $this->dispatch('/login');
        $this->assertNotRedirect();
        $this->assertQuery('#formUserLogin');
    }

    public function testLoginOk()
    {
        $this->request
             ->setMethod('POST')
             ->setPost(
                array(
                 'email' => 'john@example.net',
                 'password' => 'goodpassword'
                )
             );

        $this->dispatch('/login');
        $this->assertRedirectTo('/home');
        $this->resetRequest();
        $this->resetResponse();

        $this->dispatch('/logout');
        $this->assertRedirectTo('/login');
    }

    public function testRegisterNotOk()
    {
        $this->request->setMethod('GET');
        $this->dispatch('/register');
        $this->assertQuery('#formUser');
        $this->resetRequest();
        $this->resetResponse();

        $this->request
             ->setMethod('POST')
             ->setPost(array());
        $this->dispatch('/register');
        $this->assertNotRedirect();
        $this->assertQuery('ul.form-errors');
        $this->resetRequest();
        $this->resetResponse();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'firstname' => 'John',
                 'lastname' => 'Doe',
                 'email' => 'bademail',
                 'password' => 'john',
                 'passwordConfirmation' => 'john',
             ));
        $this->dispatch('/register');
        $this->assertNotRedirect();
        $this->assertQuery('ul.form-errors');
    }

    public function testRegisterOk()
    {
        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'firstname' => 'John',
                 'lastname' => 'Doe',
                 'email' => 'john@example.de',
                 'password' => 'john',
                 'passwordConfirmation' => 'john',
             ));

        $this->dispatch('/register');
        $this->assertRedirectTo('/login');
    }

    public function testForgotPasswordNotOk()
    {
        $this->request->setMethod('GET');
        $this->dispatch('/forgot-password');
        $this->assertQuery('#formUserForgotPassword');
        $this->resetRequest();
        $this->resetResponse();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'email' => 'john@example.info',
             ));
        $this->dispatch('/forgot-password');
        $this->assertNotRedirect();
        $this->assertQuery('ul.form-errors');
    }

    public function testForgotPasswordOk()
    {
        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'email' => 'john@example.net',
             ));
        $this->dispatch('/forgot-password');
        $this->assertRedirectTo('/login');
    }

    public function testResetPasswordNotOk()
    {
        $em = Zend_Registry::get('em');
        $user = $em->find('Application\\Models\\User', 1);

        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $this->request->setMethod('GET');
        $this->dispatch('/reset-password/' . $key);
        $this->assertQuery('#formUserResetPassword');
        $this->resetRequest();
        $this->resetResponse();

        $this->request
             ->setMethod('POST')
             ->setPost(
                array(
                 'password' => 'john',
                 'passwordConfirmation' => 'john2',
                )
             );
        $this->dispatch('/reset-password/' . $key);
        $this->assertQuery('#formUserResetPassword');
        $this->assertNotRedirect();
    }

    public function testResetPasswordOk()
    {
        $em = Zend_Registry::get('em');
        $user = $em->find('Application\\Models\\User', 1);

        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $this->request
             ->setMethod('POST')
             ->setPost(
                array(
                 'password' => 'john',
                 'passwordConfirmation' => 'john',
                )
             );
        $this->dispatch('/reset-password/' . $key);
        $this->assertRedirectTo('/login');
    }

    public function testProfileNotOk()
    {
        $this->_login();

        $this->request->setMethod('GET');
        $this->dispatch('/profile');
        $this->assertQuery('#formUser');
        $this->resetRequest();
        $this->resetResponse();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'firstname' => 'John',
                 'lastname' => 'Doe',
                 'email' => 'bademail',
                 'password' => 'john',
                 'passwordConfirmation' => 'john',
             ));
        $this->dispatch('/profile');
        $this->assertNotRedirect();
        $this->assertQuery('ul.form-errors');

        $this->_logout();
    }

    public function testProfileOk()
    {
        $this->_login();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'firstname' => 'John',
                 'lastname' => 'Doe',
                 'email' => 'john@example.net',
                 'password' => '',
                 'passwordConfirmation' => '',
             ));
        $this->dispatch('/profile');
        $this->assertRedirectTo('/profile');

        $this->_logout();
    }

    public function testActivateOk()
    {
        $em = Zend_Registry::get('em');
        $user = $em->find('Application\\Models\\User', 1);

        $key = $user->getActivation();

        $this->request
             ->setMethod('GET');
        $this->dispatch('/activate/' . $key);
        $this->assertRedirectTo('/login');
    }

    public function testListOk()
    {
        $this->_login();

        $this->request->setMethod('GET');
        $this->dispatch('/users/page-1');
        $this->assertQueryCount('table.data tr', 3);

        $this->_logout();
    }

    public function testSaveNotOk()
    {
        $this->_login();

        $this->request->setMethod('GET');
        $this->dispatch('/user-1');
        $this->assertQuery('#formUser');
        $this->resetRequest();
        $this->resetResponse();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'userId' => 1,
                 'firstname' => 'John',
                 'lastname' => 'Doe',
                 'email' => 'bademail',
                 'password' => '',
                 'passwordConfirmation' => '',
             ));
        $this->dispatch('/user-1');
        $this->assertNotRedirect();
        $this->assertQuery('ul.form-errors');
        $this->resetRequest();
        $this->resetResponse();

        $this->_logout();
    }

    public function testSaveOk()
    {
        $this->_login();

        $this->request
             ->setMethod('POST')
             ->setPost(array(
                 'userId' => 1,
                 'firstname' => 'John',
                 'lastname' => 'Doe',
                 'email' => 'john@example.net',
                 'password' => '',
                 'passwordConfirmation' => '',
             ));
        $this->dispatch('/user-1');
        $this->assertRedirectTo('/users/page-1');
        $this->resetRequest();
        $this->resetResponse();

        $this->_logout();
    }
}
