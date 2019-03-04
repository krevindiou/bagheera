<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Form\Model\MemberProfileFormModel;
use App\Form\Model\MemberRegisterFormModel;
use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class MemberServiceTest extends TestCase
{
    private $john;
    private $jane;

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
        $formModel = new MemberRegisterFormModel();

        $this->assertFalse($this->get('test.app.member')->saveRegisterForm($formModel));
    }

    public function testAddMember(): void
    {
        $formModel = new MemberRegisterFormModel();
        $formModel->email = 'james@example.net';
        $formModel->plainPassword = 'james123';
        $formModel->country = 'US';

        $this->assertTrue($this->get('test.app.member')->saveRegisterForm($formModel));
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

        $formModel = new MemberProfileFormModel();
        $formModel->email = '';

        $this->assertFalse($this->get('test.app.member')->saveProfileForm($member, $formModel));
    }

    public function testUpdateMember(): void
    {
        $member = $this->em->find('App:Member', 1);

        $formModel = new MemberProfileFormModel();
        $formModel->email = 'james@example.net';

        $this->assertTrue($this->get('test.app.member')->saveProfileForm($member, $formModel));
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

        $this->expectException(\Exception::class);
        $this->get('test.app.member')->activate($key);
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

        $this->assertSame($balances['USD'], -988200);
        $this->assertSame($balances['EUR'], 2085500);
    }
}
