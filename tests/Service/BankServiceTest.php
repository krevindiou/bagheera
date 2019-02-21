<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\Bank;
use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class BankServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->john = $this->em->find('App:Member', 1);
        $this->jane = $this->em->find('App:Member', 2);
    }

    public function testGetFormForForeignMember(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $form = $this->get('test.app.bank')->getForm($this->jane, $hsbc);
        $this->assertNull($form);
    }

    public function testGetFormForNewBank(): void
    {
        $form = $this->get('test.app.bank')->getForm($this->john);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingBank(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $form = $this->get('test.app.bank')->getForm($this->john, $hsbc);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewBankWithNoData(): void
    {
        $bank = new Bank();
        $this->assertFalse($this->get('test.app.bank')->save($this->john, $bank));
    }

    public function testSaveNewBankWithForeignMember(): void
    {
        $bank = new Bank();
        $bank->setMember($this->john);
        $bank->setName('Citigroup');
        $this->assertFalse($this->get('test.app.bank')->save($this->jane, $bank));
    }

    public function testSaveNewBank(): void
    {
        $bank = new Bank();
        $bank->setMember($this->john);
        $bank->setName('Citigroup');
        $this->assertTrue($this->get('test.app.bank')->save($this->john, $bank));
    }

    public function testSaveExistingBankWithBadData(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $hsbc->setName('');
        $this->assertFalse($this->get('test.app.bank')->save($this->john, $hsbc));
    }

    public function testSaveExistingBankWithForeignMember(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $this->assertFalse($this->get('test.app.bank')->save($this->jane, $hsbc));
    }

    public function testSaveExistingBank(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $this->assertTrue($this->get('test.app.bank')->save($this->john, $hsbc));
    }

    public function testDelete(): void
    {
        $banks = $this->em->getRepository('App:Bank')->findByDeleted(true);
        $banksNb = count($banks);

        $this->assertTrue($this->get('test.app.bank')->delete($this->john, [1]));

        $banks = $this->em->getRepository('App:Bank')->findByDeleted(true);
        $this->assertSame(count($banks), $banksNb + 1);
    }

    public function testGetBalancesNotOk(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);

        $balances = $this->get('test.app.bank')->getBalances($this->jane, $hsbc);

        $this->assertSame(count($balances), 0);
    }

    public function testGetBalancesOk(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);

        $balances = $this->get('test.app.bank')->getBalances($this->john, $hsbc);

        $this->assertSame($balances['USD'], -171000);
        $this->assertSame($balances['EUR'], 2085500);
    }
}
