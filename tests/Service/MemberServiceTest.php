<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\Member;
use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class MemberServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->john = $this->em->find('App:Member', 1);
        $this->jane = $this->em->find('App:Member', 2);
    }

    public function testGetRegisterForm(): void
    {
        $registerForm = $this->get('test.app.member')->getRegisterForm('en_US');

        $this->assertSame(get_class($registerForm), 'Symfony\Component\Form\Form');
    }

    public function testAddMemberWithNoData(): void
    {
        $member = new Member();
        $this->assertFalse($this->get('test.app.member')->save($member));
    }

    public function testAddMember(): void
    {
        $encoder = $this->get('security.password_encoder');

        $member = new Member();
        $member->setEmail('james@example.net');
        $member->setPassword($encoder->encodePassword($member, 'james123'));
        $member->setCountry('US');

        $this->assertTrue($this->get('test.app.member')->save($member));
    }

    public function testGetProfileForm(): void
    {
        $member = $this->em->find('App:Member', 1);

        $profileForm = $this->get('test.app.member')->getProfileForm($member);

        $this->assertSame(get_class($profileForm), 'Symfony\Component\Form\Form');
    }

    public function testUpdateMemberWithNoData(): void
    {
        $member = $this->em->find('App:Member', 1);
        $member->setEmail('');

        $this->assertFalse($this->get('test.app.member')->save($member));
    }

    public function testUpdateMember(): void
    {
        $member = $this->em->find('App:Member', 1);

        $this->assertTrue($this->get('test.app.member')->save($member));
    }

    public function testGetForgotPasswordForm(): void
    {
        $forgotPasswordForm = $this->get('test.app.member')->getForgotPasswordForm();

        $this->assertSame(get_class($forgotPasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testGetChangePasswordForm(): void
    {
        $changePasswordForm = $this->get('test.app.member')->getChangePasswordForm();

        $this->assertSame(get_class($changePasswordForm), 'Symfony\Component\Form\Form');
    }

    public function testChangePassword(): void
    {
        $member = $this->em->find('App:Member', 1);

        $ok = $this->get('test.app.member')->changePassword($member, 'test');

        $this->assertTrue($ok);
    }

    public function testActivateWithBadKey(): void
    {
        $key = 'badkeybadkeybadkeybadkeybadkeyba';

        $ok = $this->get('test.app.member')->activate($key);

        $this->assertFalse($ok);
    }

    public function testActivateOk(): void
    {
        $member = $this->em->find('App:Member', 1);

        $key = $this->get('test.app.member')->createRegisterKey($member);

        $ok = $this->get('test.app.member')->activate($key);

        $this->assertTrue($ok);
    }

    public function testGetBalances(): void
    {
        $member = $this->em->find('App:Member', 1);

        $balances = $this->get('test.app.member')->getBalances($member);

        $this->assertSame($balances['USD'], -98.82);
        $this->assertSame($balances['EUR'], '208.55');
    }
}
