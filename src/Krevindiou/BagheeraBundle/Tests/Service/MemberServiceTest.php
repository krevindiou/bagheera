<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\Member;

class MemberServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('Model:Member', 1);
        $this->jane = $this->em->find('Model:Member', 2);
    }

    public function testGetRegisterForm()
    {
        $registerForm = $this->get('bagheera.member')->getRegisterForm('en_US');

        $this->assertEquals(get_class($registerForm), 'Symfony\Component\Form\Form');
    }

    public function testAddMemberWithNoData()
    {
        $member = new Member();
        $this->assertFalse($this->get('bagheera.member')->save($member));
    }

    public function testAddMember()
    {
        $member = new Member();
        $member->setEmail('james@example.net');

        $encoder = $this->get('security.encoder_factory')->getEncoder($member);
        $member->setPassword($encoder->encodePassword('james123', $member->getSalt()));
        $member->setCountry('US');

        $this->assertTrue($this->get('bagheera.member')->save($member));
    }

    public function testGetProfileForm()
    {
        $member = $this->em->find('Model:Member', 1);

        $profileForm = $this->get('bagheera.member')->getProfileForm($member);

        $this->assertEquals(get_class($profileForm), 'Symfony\Component\Form\Form');
    }

    public function testUpdateMemberWithNoData()
    {
        $member = $this->em->find('Model:Member', 1);
        $member->setEmail('');

        $this->assertFalse($this->get('bagheera.member')->save($member));
    }

    public function testUpdateMember()
    {
        $member = $this->em->find('Model:Member', 1);

        $this->assertTrue($this->get('bagheera.member')->save($member));
    }

    public function testToggleDeactivation()
    {
        $membersId = [1, 2];

        $this->get('bagheera.member')->toggleDeactivation($membersId);

        $members = $this->em->getRepository('Model:Member')->findByActive(true);

        $this->assertEquals(count($members), 0);
    }

    public function testGetForgotPasswordForm()
    {
        $forgotPasswordForm = $this->get('bagheera.member')->getForgotPasswordForm();

        $this->assertEquals(get_class($forgotPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetChangePasswordForm()
    {
        $changePasswordForm = $this->get('bagheera.member')->getChangePasswordForm();

        $this->assertEquals(get_class($changePasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testChangePassword()
    {
        $member = $this->em->find('Model:Member', 1);

        $ok = $this->get('bagheera.member')->changePassword($member, 'test');

        $this->assertTrue($ok);
    }

    public function testActivateWithBadKey()
    {
        $key = 'badkeybadkeybadkeybadkeybadkeyba';

        $ok = $this->get('bagheera.member')->activate($key);

        $this->assertFalse($ok);
    }

    public function testActivateOk()
    {
        $member = $this->em->find('Model:Member', 1);

        $key = $this->get('bagheera.member')->createRegisterKey($member);

        $ok = $this->get('bagheera.member')->activate($key);

        $this->assertTrue($ok);
    }

    public function testGetMembersNoResult()
    {
        $params = [
            'email' => 'james@example.net'
        ];

        $members = $this->get('bagheera.member')->getMembers($params);

        $this->assertEquals(count($members), 0);
    }

    public function testGetMembersJohn()
    {
        $params = [
            'email' => 'john@example.net'
        ];

        $members = $this->get('bagheera.member')->getMembers($params);

        $this->assertEquals(count($members), 1);
    }

    public function testGetMembersAll()
    {
        $params = [];

        $members = $this->get('bagheera.member')->getMembers($params);

        $this->assertEquals(count($members), 3);
    }

    public function testGetBalances()
    {
        $member = $this->em->find('Model:Member', 1);

        $balances = $this->get('bagheera.member')->getBalances($member);

        $this->assertEquals($balances['USD'], -98.82);
        $this->assertEquals($balances['EUR'], 208.55);
    }
}
