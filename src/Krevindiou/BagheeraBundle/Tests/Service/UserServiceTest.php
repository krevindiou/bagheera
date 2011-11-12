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

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Symfony\Component\HttpFoundation\Request,
    Krevindiou\BagheeraBundle\Tests\TestCase;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\UserServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserServiceTest extends TestCase
{
    public function testGetRegisterForm()
    {
        $registerForm = $this->get('bagheera.user')->getRegisterForm();

        $this->assertEquals(get_class($registerForm), 'Symfony\Component\Form\Form');
    }

    public function testRegisterEmpty()
    {
        $registerForm = $this->get('bagheera.user')->getRegisterForm();

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterEmailExists()
    {
        $values = array(
            'firstname' => 'James',
            'lastname' => 'Doe',
            'email' => 'john@example.net',
            'password' => array(
                'userPassword' => 'james123',
                'userPasswordConfirmation' => 'james123',
            ),
        );

        $registerForm = $this->get('bagheera.user')->getRegisterForm($values);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterPasswordsMismatch()
    {
        $values = array(
            'firstname' => 'James',
            'lastname' => 'Doe',
            'email' => 'james@example.net',
            'password' => array(
                'userPassword' => 'james123',
                'userPasswordConfirmation' => 'james456',
            ),
        );

        $registerForm = $this->get('bagheera.user')->getRegisterForm($values);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterPasswordsTooShort()
    {
        $values = array(
            'firstname' => 'James',
            'lastname' => 'Doe',
            'email' => 'james@example.net',
            'password' => array(
                'userPassword' => 'james12',
                'userPasswordConfirmation' => 'james12',
            ),
        );

        $registerForm = $this->get('bagheera.user')->getRegisterForm($values);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterOk()
    {
        $values = array(
            'firstname' => 'James',
            'lastname' => 'Doe',
            'email' => 'james@example.net',
            'password' => array(
                'userPassword' => 'james123',
                'userPasswordConfirmation' => 'james123',
            ),
        );

        $registerForm = $this->get('bagheera.user')->getRegisterForm($values);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertTrue($ok);
    }

    public function testGetProfileForm()
    {
        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user);

        $this->assertEquals(get_class($profileForm), 'Symfony\Component\Form\Form');
    }

    public function testProfilePasswordsMismatch()
    {
        $values = array(
            'firstname' => 'John',
            'lastname' => 'Doe',
            'email' => 'john@example.net',
            'password' => array(
                'userPassword' => 'john1234',
                'userPasswordConfirmation' => 'john12345',
            ),
        );

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user, $values);

        $ok = $this->get('bagheera.user')->update($profileForm);

        $this->assertFalse($ok);
    }

    public function testProfileUpdatePassword()
    {
        $values = array(
            'firstname' => 'John',
            'lastname' => 'Doe',
            'email' => 'john@example.net',
            'password' => array(
                'userPassword' => 'john1234',
                'userPasswordConfirmation' => 'john1234',
            ),
        );

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user, $values);

        $ok = $this->get('bagheera.user')->update($profileForm);

        $this->assertTrue($ok);
    }

    public function testProfileWithoutPassword()
    {
        $values = array(
            'firstname' => 'John',
            'lastname' => 'Doe',
            'email' => 'john@example.net',
            'password' => array(
                'userPassword' => '',
                'userPasswordConfirmation' => '',
            ),
        );

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user, $values);

        $ok = $this->get('bagheera.user')->update($profileForm);

        $this->assertTrue($ok);
    }

    public function testToggleDeactivation()
    {
        $usersId = array(1, 2);

        $this->get('bagheera.user')->toggleDeactivation($usersId);

        $users = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->findByIsActive(true);

        $this->assertEquals(count($users), 0);
    }

    public function testGetForgotPasswordForm()
    {
        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm();

        $this->assertEquals(get_class($forgotPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testSendResetPasswordEmailNotOk()
    {
        $values = array(
            'email' => 'james@example.net',
        );

        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm($values);

        $ok = $this->get('bagheera.user')->sendResetPasswordEmail($forgotPasswordForm);

        $this->assertFalse($ok);
    }

    public function testSendResetPasswordEmailOk()
    {
        $values = array(
            'email' => 'john@example.net',
        );

        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm($values);

        $ok = $this->get('bagheera.user')->sendResetPasswordEmail($forgotPasswordForm);

        $this->assertTrue($ok);
    }

    public function testGetResetPasswordFormNotOk()
    {
        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate('badkey'));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key);

        $this->assertNotEquals(get_class($resetPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetResetPasswordFormOk()
    {
        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key);

        $this->assertEquals(get_class($resetPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testResetPasswordNotOk()
    {
        $values = array(
            'password' => array(
                'userPassword' => 'john1234',
                'userPasswordConfirmation' => 'john12345',
            ),
        );

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key, $values);
        $ok = $this->get('bagheera.user')->resetPassword($resetPasswordForm, $key);

        $this->assertFalse($ok);
    }

    public function testResetPasswordOk()
    {
        $values = array(
            'password' => array(
                'userPassword' => 'john1234',
                'userPasswordConfirmation' => 'john1234',
            ),
        );

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key, $values);
        $ok = $this->get('bagheera.user')->resetPassword($resetPasswordForm, $key);

        $this->assertTrue($ok);
    }

    public function testActivateNotOk()
    {
        $key = 'badkey';

        $ok = $this->get('bagheera.user')->activate($key);

        $this->assertFalse($ok);
    }

    public function testActivateOk()
    {
        $key = 'b4fa77f5180803d0f6f4f504594da09e';

        $ok = $this->get('bagheera.user')->activate($key);

        $this->assertTrue($ok);
    }

    public function testGetUsersNone()
    {
        $params = array(
            'email' => 'james@example.net'
        );

        $users = $this->get('bagheera.user')->getUsers($params);

        $this->assertEquals(count($users), 0);
    }

    public function testGetUsersJohn()
    {
        $params = array(
            'firstname' => 'John'
        );

        $users = $this->get('bagheera.user')->getUsers($params);

        $this->assertEquals(count($users), 1);
    }

    public function testGetUsersAll()
    {
        $params = array();

        $users = $this->get('bagheera.user')->getUsers($params);

        $this->assertEquals(count($users), 2);
    }

    public function testGetBalance()
    {
        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $balance = $this->get('bagheera.user')->getBalance($user);

        $this->assertEquals($balance, 210.92);
    }
}
