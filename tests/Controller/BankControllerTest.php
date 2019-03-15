<?php

declare(strict_types=1);

namespace App\Tests\Controller;

use App\Tests\E2eTestCase;

/**
 * @internal
 * @coversNothing
 */
final class BankControllerTest extends E2eTestCase
{
    public function testCreateForm()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/choose-bank');
        $form = $crawler->selectButton('bank_choose_form[submit]')->form();
        $form['bank_choose_form[other]'] = 'New bank';
        $client->submit($form);

        $this->assertSame(true, $client->getResponse()->isRedirect('/en/manager/bank-6/create-account'));
    }

    public function testUpdateForm()
    {
        $client = static::createAuthenticatedClient();
        $crawler = $client->request('GET', '/en/manager/bank-1');
        $form = $crawler->selectButton('bank_update_form[submit]')->form();
        $client->submit($form);

        $this->assertSame(true, $client->getResponse()->isRedirect('/en/manager/bank-1'));
    }
}
