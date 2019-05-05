<?php

declare(strict_types=1);

namespace App\Tests\Controller;

use App\Tests\E2eTestCase;

/**
 * @internal
 * @coversNothing
 */
final class AccountControllerTest extends E2eTestCase
{
    public function testListAccounts()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/accounts');

        $this->assertSame(4, $crawler->filter('#content input[name="accountsId[]"]')->count());
    }

    public function testHome()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/');

        $this->assertSame(4, $crawler->filter('#content span.label')->count());
    }

    public function testCreateForm()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/bank-2/create-account');
        $form = $crawler->selectButton('account_form[submit]')->form();
        $form['account_form[name]'] = 'New bank';
        $client->submit($form);

        $this->assertSame(true, $client->getResponse()->isRedirect('/en/manager/account-9/operations'));
    }

    public function testUpdateForm()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/account-1');
        $form = $crawler->selectButton('account_form[submit]')->form();
        $client->submit($form);

        $this->assertSame(true, $client->getResponse()->isRedirect('/en/manager/accounts'));
    }

    public function testDeleteAccount()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/accounts');
        $form = $crawler->selectButton('Delete')->form();
        $form['accountsId'][0]->tick();
        $client->submit($form);

        $this->assertSame(true, $client->getResponse()->isRedirect('/en/manager/accounts'));
        $crawler = $client->followRedirect();

        $this->assertSame(3, $crawler->filter('#content input[name="accountsId[]"]')->count());
    }

    public function testCloseAccount()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/accounts');
        $form = $crawler->selectButton('Close')->form();
        $client->submit($form);

        $this->assertSame(true, $client->getResponse()->isRedirect('/en/manager/accounts'));
        $crawler = $client->followRedirect();

        $this->assertSame(1, $crawler->filter('#content input[name="accountsId[]"]')->count());
    }
}
