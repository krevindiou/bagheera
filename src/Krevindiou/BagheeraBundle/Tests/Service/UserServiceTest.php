<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\User;

class UserServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->em->find('KrevindiouBagheeraBundle:User', 2);
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
        $user = $this->em->find('KrevindiouBagheeraBundle:User', 1);

        $profileForm = $this->get('bagheera.user')->getProfileForm($user);

        $this->assertEquals(get_class($profileForm), 'Symfony\Component\Form\Form');
    }

    public function testUpdateUserWithNoData()
    {
        $user = $this->em->find('KrevindiouBagheeraBundle:User', 1);
        $user->setEmail('');

        $this->assertFalse($this->get('bagheera.user')->save($user));
    }

    public function testUpdateUser()
    {
        $user = $this->em->find('KrevindiouBagheeraBundle:User', 1);

        $this->assertTrue($this->get('bagheera.user')->save($user));
    }

    public function testToggleDeactivation()
    {
        $usersId = array(1, 2);

        $this->get('bagheera.user')->toggleDeactivation($usersId);

        $users = $this->em->getRepository('KrevindiouBagheeraBundle:User')->findByActive(true);

        $this->assertEquals(count($users), 0);
    }

    public function testGetForgotPasswordForm()
    {
        $forgotPasswordForm = $this->get('bagheera.user')->getForgotPasswordForm();

        $this->assertEquals(get_class($forgotPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetChangePasswordForm()
    {
        $changePasswordForm = $this->get('bagheera.user')->getChangePasswordForm();

        $this->assertEquals(get_class($changePasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testChangePassword()
    {
        $user = $this->em->find('KrevindiouBagheeraBundle:User', 1);

        $ok = $this->get('bagheera.user')->changePassword($user, 'test');

        $this->assertTrue($ok);
    }

    public function testActivateWithBadKey()
    {
        $key = 'badkeybadkeybadkeybadkeybadkeyba';

        $ok = $this->get('bagheera.user')->activate($key);

        $this->assertFalse($ok);
    }

    public function testActivateOk()
    {
        $user = $this->em->find('KrevindiouBagheeraBundle:User', 1);

        $key = $this->get('bagheera.user')->createRegisterKey($user);

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

        $this->assertEquals(count($users), 3);
    }

    public function testGetBalances()
    {
        $user = $this->em->find('KrevindiouBagheeraBundle:User', 1);

        $balances = $this->get('bagheera.user')->getBalances($user);

        $this->assertEquals($balances['USD'], -98.82);
        $this->assertEquals($balances['EUR'], 208.55);
    }
}
