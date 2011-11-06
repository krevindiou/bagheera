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
        $request = new Request();

        $registerForm = $this->get('bagheera.user')->getRegisterForm($request);

        $this->assertEquals(get_class($registerForm), 'Symfony\Component\Form\Form');
    }

    public function testRegisterEmpty()
    {
        $request = new Request();
        $request->setMethod('POST');

        $registerForm = $this->get('bagheera.user')->getRegisterForm($request);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterEmailExists()
    {
        $post = array(
            'krevindiou_bagheerabundle_userregistertype' => array(
                'firstname' => 'James',
                'lastname' => 'Doe',
                'email' => 'john@example.net',
                'password' => array(
                    'userPassword' => 'james123',
                    'userPasswordConfirmation' => 'james123',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $registerForm = $this->get('bagheera.user')->getRegisterForm($request);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterPasswordsMismatch()
    {
        $post = array(
            'krevindiou_bagheerabundle_userregistertype' => array(
                'firstname' => 'James',
                'lastname' => 'Doe',
                'email' => 'james@example.net',
                'password' => array(
                    'userPassword' => 'james123',
                    'userPasswordConfirmation' => 'james456',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $registerForm = $this->get('bagheera.user')->getRegisterForm($request);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterPasswordsTooShort()
    {
        $post = array(
            'krevindiou_bagheerabundle_userregistertype' => array(
                'firstname' => 'James',
                'lastname' => 'Doe',
                'email' => 'james@example.net',
                'password' => array(
                    'userPassword' => 'james12',
                    'userPasswordConfirmation' => 'james12',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $registerForm = $this->get('bagheera.user')->getRegisterForm($request);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertFalse($ok);
    }

    public function testRegisterOk()
    {
        $post = array(
            'krevindiou_bagheerabundle_userregistertype' => array(
                'firstname' => 'James',
                'lastname' => 'Doe',
                'email' => 'james@example.net',
                'password' => array(
                    'userPassword' => 'james123',
                    'userPasswordConfirmation' => 'james123',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $registerForm = $this->get('bagheera.user')->getRegisterForm($request);

        $ok = $this->get('bagheera.user')->add($registerForm);

        $this->assertTrue($ok);
    }

    public function testGetProfileForm()
    {
        $request = new Request();
        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user, $request);

        $this->assertEquals(get_class($profileForm), 'Symfony\Component\Form\Form');
    }

    public function testProfilePasswordsMismatch()
    {
        $post = array(
            'krevindiou_bagheerabundle_userprofiletype' => array(
                'firstname' => 'John',
                'lastname' => 'Doe',
                'email' => 'john@example.net',
                'password' => array(
                    'userPassword' => 'john1234',
                    'userPasswordConfirmation' => 'john12345',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user, $request);

        $ok = $this->get('bagheera.user')->update($profileForm);

        $this->assertFalse($ok);
    }

    public function testProfileUpdatePassword()
    {
        $post = array(
            'krevindiou_bagheerabundle_userprofiletype' => array(
                'firstname' => 'John',
                'lastname' => 'Doe',
                'email' => 'john@example.net',
                'password' => array(
                    'userPassword' => 'john1234',
                    'userPasswordConfirmation' => 'john1234',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user, $request);

        $ok = $this->get('bagheera.user')->update($profileForm);

        $this->assertTrue($ok);
    }

    public function testProfileWithoutPassword()
    {
        $post = array(
            'krevindiou_bagheerabundle_userprofiletype' => array(
                'firstname' => 'John',
                'lastname' => 'Doe',
                'email' => 'john@example.net',
                'password' => array(
                    'userPassword' => '',
                    'userPasswordConfirmation' => '',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user, $request);

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
        $request = new Request();

        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm($request);

        $this->assertEquals(get_class($forgotPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testSendResetPasswordEmailNotOk()
    {
        $post = array(
            'krevindiou_bagheerabundle_userforgotpasswordtype' => array(
                'email' => 'james@example.net',
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm($request);

        $ok = $this->get('bagheera.user')->sendResetPasswordEmail($forgotPasswordForm);

        $this->assertFalse($ok);
    }

    public function testSendResetPasswordEmailOk()
    {
        $post = array(
            'krevindiou_bagheerabundle_userforgotpasswordtype' => array(
                'email' => 'john@example.net',
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm($request);

        $ok = $this->get('bagheera.user')->sendResetPasswordEmail($forgotPasswordForm);

        $this->assertTrue($ok);
    }

    public function testGetResetPasswordFormNotOk()
    {
        $request = new Request();

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate('badkey'));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key, $request);

        $this->assertNotEquals(get_class($resetPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetResetPasswordFormOk()
    {
        $request = new Request();

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key, $request);

        $this->assertEquals(get_class($resetPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testResetPasswordNotOk()
    {
        $post = array(
            'krevindiou_bagheerabundle_userresetpasswordtype' => array(
                'password' => array(
                    'userPassword' => 'john1234',
                    'userPasswordConfirmation' => 'john12345',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key, $request);
        $ok = $this->get('bagheera.user')->resetPassword($resetPasswordForm, $key);

        $this->assertFalse($ok);
    }

    public function testResetPasswordOk()
    {
        $post = array(
            'krevindiou_bagheerabundle_userresetpasswordtype' => array(
                'password' => array(
                    'userPassword' => 'john1234',
                    'userPasswordConfirmation' => 'john1234',
                ),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key, $request);
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
