<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\Account;
use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class AccountServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->john = $this->em->find('App:Member', 1);
        $this->jane = $this->em->find('App:Member', 2);
    }

    public function testGetFormForForeignMember(): void
    {
        $account = $this->em->find('App:Account', 1);
        $form = $this->get('test.app.account')->getUpdateForm($this->jane, $account);
        $this->assertNull($form);
    }

    public function testGetFormForNewAccount(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);

        $form = $this->get('test.app.account')->getCreateForm($this->john, $hsbc);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingAccount(): void
    {
        $account = $this->em->find('App:Account', 1);
        $form = $this->get('test.app.account')->getUpdateForm($this->john, $account);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewAccountWithNoData(): void
    {
        $account = new Account();
        $this->assertFalse($this->get('test.app.account')->save($this->john, $account));
    }

    public function testSaveNewAccountWithForeignBank(): void
    {
        $account = new Account();
        $account->setBank($this->em->find('App:Bank', 5));
        $account->setName('Checking account #1');
        $account->setCurrency('USD');
        $this->assertFalse($this->get('test.app.account')->save($this->john, $account));
    }

    public function testSaveNewAccount(): void
    {
        $account = new Account();
        $account->setBank($this->em->find('App:Bank', 1));
        $account->setName('Checking account #1');
        $account->setCurrency('USD');
        $this->assertTrue($this->get('test.app.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithBadData(): void
    {
        $account = $this->em->find('App:Account', 1);
        $account->setName('');
        $account->setCurrency('USD');
        $this->assertFalse($this->get('test.app.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithForeignBank(): void
    {
        $account = $this->em->find('App:Account', 1);
        $account->setBank($this->em->find('App:Bank', 5));
        $this->assertFalse($this->get('test.app.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithForeignMember(): void
    {
        $account = $this->em->find('App:Account', 1);
        $this->assertFalse($this->get('test.app.account')->save($this->jane, $account));
    }

    public function testSaveExistingAccount(): void
    {
        $account = $this->em->find('App:Account', 1);
        $this->assertTrue($this->get('test.app.account')->save($this->john, $account));
    }

    public function testDelete(): void
    {
        $accounts = $this->em->getRepository('App:Account')->findByDeleted(true);
        $accountsNb = count($accounts);

        $this->assertTrue($this->get('test.app.account')->delete($this->john, [1]));

        $accounts = $this->em->getRepository('App:Account')->findByDeleted(true);
        $this->assertSame(count($accounts), $accountsNb + 1);
    }

    public function testGetBalanceNotOk(): void
    {
        $account = $this->em->getRepository('App:Account')->find(1);

        $balance = $this->get('test.app.account')->getBalance($this->jane, $account);

        $this->assertSame($balance, 0);
    }

    public function testGetBalanceOk(): void
    {
        $account = $this->em->getRepository('App:Account')->find(1);

        $balance = $this->get('test.app.account')->getBalance($this->john, $account);

        $this->assertSame($balance, -214900);
    }

    public function testSynthesis(): void
    {
        $expectedData = [
            'USD' => [
                strtotime('2011-01-01 UTC') => 0,
                strtotime('2011-02-01 UTC') => 0,
                strtotime('2011-03-01 UTC') => 0,
                strtotime('2011-04-01 UTC') => 0,
                strtotime('2011-05-01 UTC') => 0,
                strtotime('2011-06-01 UTC') => 0,
                strtotime('2011-07-01 UTC') => 0,
                strtotime('2011-08-01 UTC') => 0,
                strtotime('2011-09-01 UTC') => -1371300,
                strtotime('2011-10-01 UTC') => -988200,
                strtotime('2011-11-01 UTC') => -988200,
                strtotime('2011-12-01 UTC') => -988200,
            ],
            'EUR' => [
                strtotime('2011-01-01 UTC') => 0,
                strtotime('2011-02-01 UTC') => 0,
                strtotime('2011-03-01 UTC') => 0,
                strtotime('2011-04-01 UTC') => 0,
                strtotime('2011-05-01 UTC') => 0,
                strtotime('2011-06-01 UTC') => 0,
                strtotime('2011-07-01 UTC') => 0,
                strtotime('2011-08-01 UTC') => 0,
                strtotime('2011-09-01 UTC') => 2085500,
                strtotime('2011-10-01 UTC') => 2085500,
                strtotime('2011-11-01 UTC') => 2085500,
                strtotime('2011-12-01 UTC') => 2085500,
            ],
        ];

        $data = $this->get('test.app.report')->getSynthesis(
            $this->john,
            new \DateTime('2011-01-01'),
            new \DateTime('2011-12-31')
        );

        $this->assertSame($data['points']['USD'], $expectedData['USD']);
        $this->assertSame($data['points']['EUR'], $expectedData['EUR']);
    }
}
