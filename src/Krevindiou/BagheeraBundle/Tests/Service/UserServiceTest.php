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

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\User;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\UserServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->_em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetRegisterForm()
    {
        $registerForm = $this->get('bagheera.user')->getRegisterForm('en_US');

        $this->assertEquals(get_class($registerForm), 'Symfony\Component\Form\Form');
    }

    public function testAddUserWithNoData()
    {
        $user = new User();
        $this->assertFalse($this->get('bagheera.user')->save($user));
    }

    public function testAddUser()
    {
        $user = new User();
        $user->setEmail('james@example.net');

        $encoder = $this->get('security.encoder_factory')->getEncoder($user);
        $user->setPassword($encoder->encodePassword('james123', $user->getSalt()));
        $user->setCountry('US');

        $this->assertTrue($this->get('bagheera.user')->save($user));
    }

    public function testGetProfileForm()
    {
        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user);

        $this->assertEquals(get_class($profileForm), 'Symfony\Component\Form\Form');
    }

    public function testUpdateUserWithNoData()
    {
        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $user->setEmail('');

        $this->assertFalse($this->get('bagheera.user')->save($user));
    }

    public function testUpdateUser()
    {
        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);

        $this->assertTrue($this->get('bagheera.user')->save($user));
    }

    public function testToggleDeactivation()
    {
        $usersId = array(1, 2);

        $this->get('bagheera.user')->toggleDeactivation($usersId);

        $users = $this->_em->getRepository('KrevindiouBagheeraBundle:User')->findByIsActive(true);

        $this->assertEquals(count($users), 0);
    }

    public function testGetForgotPasswordForm()
    {
        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm();

        $this->assertEquals(get_class($forgotPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetResetPasswordFormWithBadKey()
    {
        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $key = base64_encode(gzdeflate('badkey'));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key);

        $this->assertNotEquals(get_class($resetPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetResetPasswordFormOk()
    {
        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        $resetPasswordForm = $this->get('bagheera.user')->getResetPasswordForm($key);

        $this->assertEquals(get_class($resetPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testActivateWithBadKey()
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

    public function testGetUsersNoResult()
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
            'email' => 'john@example.net'
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

    public function testGetBalances()
    {
        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);

        $balances = $this->get('bagheera.user')->getBalances($user);

        $this->assertEquals($balances['USD'], 210.92);
    }
}
