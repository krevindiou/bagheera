<?php

declare(strict_types=1);

namespace App\Tests\Controller;

use App\Tests\E2eTestCase;

/**
 * @internal
 * @coversNothing
 */
final class MemberControllerTest extends E2eTestCase
{
    public function testRedirectFromRoot(): void
    {
        $client = static::createClient();
        $client->request('GET', '/');

        $this->assertTrue($client->getResponse()->isRedirect('http://localhost/en/sign-in'));
    }

    public function testLogin(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/en/sign-in');
        $form = $crawler->selectButton('login')->form();
        $form['_username'] = 'john@example.net';
        $form['_password'] = 'johnjohn';
        $client->submit($form);

        $this->assertTrue($client->getResponse()->isRedirect('http://localhost/en/manager/'));
    }

    public function testLogout(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/en/sign-in');
        $form = $crawler->selectButton('login')->form();
        $form['_username'] = 'john@example.net';
        $form['_password'] = 'johnjohn';
        $client->submit($form);
        $crawler = $client->followRedirect();

        $link = $crawler->selectLink('Logout')->link();
        $client->click($link);

        $this->assertTrue($client->getResponse()->isRedirect('http://localhost/'));
    }

    public function testRegister(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/en/register');
        $form = $crawler->selectButton('member_register_form[submit]')->form();
        $form['member_register_form[email]'] = 'james@example.net';
        $form['member_register_form[country]'] = 'US';
        $form['member_register_form[plainPassword][first]'] = 'jamesjames';
        $form['member_register_form[plainPassword][second]'] = 'jamesjames';
        $client->submit($form);

        $this->assertTrue($client->getResponse()->isRedirect('/en/sign-in'));
    }

    public function testForgotPassword(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/en/forgot-password');
        $form = $crawler->selectButton('member_forgot_password_form[submit]')->form();
        $form['member_forgot_password_form[email]'] = 'john@example.net';
        $client->submit($form);

        $this->assertTrue($client->getResponse()->isRedirect('/en/sign-in'));
    }

    public function testChangePasswordPublic(): void
    {
        $client = static::createClient();
        $key = 'SghZD4l9pAGSc7hTCgt+ESHxo9gubXvu3AzCsRMVj3hzAok71GyznJl05neeiWxwQQmlMB8vp9A1Ndo7O2r1LfGYkZHHQjgFMTEHXruVjieVQiwKAwcZkalKBFY3kB/017Vccf7jzhwri0SqN3hzyQ==';
        $crawler = $client->request('GET', "/en/change-password/${key}");

        $form = $crawler->selectButton('member_change_password_form[submit]')->form();
        $form['member_change_password_form[password][first]'] = 'johnjohn';
        $form['member_change_password_form[password][second]'] = 'johnjohn';
        $client->submit($form);

        $this->assertTrue($client->getResponse()->isRedirect('/en/sign-in'));
    }

    public function testChangePassword(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/change-password');
        $form = $crawler->selectButton('member_change_password_form[submit]')->form();
        $form['member_change_password_form[password][first]'] = 'johnjohn';
        $form['member_change_password_form[password][second]'] = 'johnjohn';
        $client->submit($form);

        $this->assertTrue($client->getResponse()->isRedirect('/en/manager/change-password'));
    }

    public function testActivate(): void
    {
        $client = static::createClient();
        $key = 'yxob4g7V3GeK5pPtXgc5VQMg9IYpiCcpRvVMiX75e84qEOO7frxTpjlm3idxqIx4jrH8F4R0yJeujjqQkMuKug==';
        $client->request('GET', "/en/activate?key=${key}");

        $this->assertTrue($client->getResponse()->isRedirect('/en/sign-in'));
    }

    public function testProfile(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/profile');
        $form = $crawler->selectButton('member_profile_form[submit]')->form();
        $client->submit($form);

        $this->assertTrue($client->getResponse()->isRedirect('/en/manager/profile'));
    }
}
