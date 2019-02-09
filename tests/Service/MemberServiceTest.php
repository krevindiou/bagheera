<?php

namespace App\Tests\Service;

use App\Tests\TestCase;
use App\Entity\Member;

class MemberServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('App:Member', 1);
        $this->jane = $this->em->find('App:Member', 2);
    }

    public function testGetRegisterForm()
    {
        $registerForm = $this->get('app.member')->getRegisterForm('en_US');

        $this->assertEquals(get_class($registerForm), 'Symfony\Component\Form\Form');
    }

    public function testAddMemberWithNoData()
    {
        $member = new Member();
        $this->assertFalse($this->get('app.member')->save($member));
    }

    public function testAddMember()
    {
        $encoder = $this->get('security.password_encoder');

        $member = new Member();
        $member->setEmail('james@example.net');
        $member->setPassword($encoder->encodePassword($member, 'james123'));
        $member->setCountry('US');

        $this->assertTrue($this->get('app.member')->save($member));
    }

    public function testGetProfileForm()
    {
        $member = $this->em->find('App:Member', 1);

        $profileForm = $this->get('app.member')->getProfileForm($member);

        $this->assertEquals(get_class($profileForm), 'Symfony\Component\Form\Form');
    }

    public function testUpdateMemberWithNoData()
    {
        $member = $this->em->find('App:Member', 1);
        $member->setEmail('');

        $this->assertFalse($this->get('app.member')->save($member));
    }

    public function testUpdateMember()
    {
        $member = $this->em->find('App:Member', 1);

        $this->assertTrue($this->get('app.member')->save($member));
    }

    public function testGetForgotPasswordForm()
    {
        $forgotPasswordForm = $this->get('app.member')->getForgotPasswordForm();

        $this->assertEquals(get_class($forgotPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetChangePasswordForm()
    {
        $changePasswordForm = $this->get('app.member')->getChangePasswordForm();

        $this->assertEquals(get_class($changePasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testChangePassword()
    {
        $member = $this->em->find('App:Member', 1);

        $ok = $this->get('app.member')->changePassword($member, 'test');

        $this->assertTrue($ok);
    }

    public function testActivateWithBadKey()
    {
        $key = 'badkeybadkeybadkeybadkeybadkeyba';

        $ok = $this->get('app.member')->activate($key);

        $this->assertFalse($ok);
    }

    public function testActivateOk()
    {
        $member = $this->em->find('App:Member', 1);

        $key = $this->get('app.member')->createRegisterKey($member);

        $ok = $this->get('app.member')->activate($key);

        $this->assertTrue($ok);
    }

    public function testGetBalances()
    {
        $member = $this->em->find('App:Member', 1);

        $balances = $this->get('app.member')->getBalances($member);

        $this->assertEquals($balances['USD'], -98.82);
        $this->assertEquals($balances['EUR'], 208.55);
    }
}
