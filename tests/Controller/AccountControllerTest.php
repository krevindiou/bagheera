<?php

declare(strict_types=1);

namespace App\Tests\Controller;

/**
 * @internal
 * @coversNothing
 */
final class AccountControllerTest extends E2eTestCase
{
    public function testListAccounts(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/accounts');

        static::assertSame(4, $crawler->filter('#content input[name="accountsId[]"]')->count());
    }

    public function testHome(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/');

        static::assertSame(4, $crawler->filter('#content span.label')->count());
    }

    public function testCreateForm(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/bank-2/create-account');
        $form = $crawler->selectButton('account_form[submit]')->form();
        $form['account_form[name]'] = 'New bank';
        $client->submit($form);

        static::assertTrue($client->getResponse()->isRedirect('/en/manager/account-9/operations'));
    }

    public function testUpdateForm(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/account-1');
        $form = $crawler->selectButton('account_form[submit]')->form();
        $client->submit($form);

        static::assertTrue($client->getResponse()->isRedirect('/en/manager/accounts'));
    }

    public function testDeleteAccount(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/accounts');
        $form = $crawler->selectButton('Delete')->form();
        $form['accountsId'][0]->tick();
        $client->submit($form);

        static::assertTrue($client->getResponse()->isRedirect('/en/manager/accounts'));
        $crawler = $client->followRedirect();

        static::assertSame(3, $crawler->filter('#content input[name="accountsId[]"]')->count());
    }

    public function testCloseAccount(): void
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/accounts');
        $form = $crawler->selectButton('Close')->form();
        $client->submit($form);

        static::assertTrue($client->getResponse()->isRedirect('/en/manager/accounts'));
        $crawler = $client->followRedirect();

        static::assertSame(1, $crawler->filter('#content input[name="accountsId[]"]')->count());
    }
}
