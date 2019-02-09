<?php

namespace App\Tests\Service;

use App\Tests\TestCase;
use App\Entity\Bank;

class BankServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('App:Member', 1);
        $this->jane = $this->em->find('App:Member', 2);
    }

    public function testGetFormForForeignMember()
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $form = $this->get('app.bank')->getForm($this->jane, $hsbc);
        $this->assertNull($form);
    }

    public function testGetFormForNewBank()
    {
        $form = $this->get('app.bank')->getForm($this->john);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingBank()
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $form = $this->get('app.bank')->getForm($this->john, $hsbc);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewBankWithNoData()
    {
        $bank = new Bank();
        $this->assertFalse($this->get('app.bank')->save($this->john, $bank));
    }

    public function testSaveNewBankWithForeignMember()
    {
        $bank = new Bank();
        $bank->setMember($this->john);
        $bank->setName('Citigroup');
        $this->assertFalse($this->get('app.bank')->save($this->jane, $bank));
    }

    public function testSaveNewBank()
    {
        $bank = new Bank();
        $bank->setMember($this->john);
        $bank->setName('Citigroup');
        $this->assertTrue($this->get('app.bank')->save($this->john, $bank));
    }

    public function testSaveExistingBankWithBadData()
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $hsbc->setName('');
        $this->assertFalse($this->get('app.bank')->save($this->john, $hsbc));
    }

    public function testSaveExistingBankWithForeignMember()
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $this->assertFalse($this->get('app.bank')->save($this->jane, $hsbc));
    }

    public function testSaveExistingBank()
    {
        $hsbc = $this->em->find('App:Bank', 1);
        $this->assertTrue($this->get('app.bank')->save($this->john, $hsbc));
    }

    public function testDelete()
    {
        $banks = $this->em->getRepository('App:Bank')->findByDeleted(true);
        $banksNb = count($banks);

        $this->assertTrue($this->get('app.bank')->delete($this->john, [1]));

        $banks = $this->em->getRepository('App:Bank')->findByDeleted(true);
        $this->assertEquals(count($banks), $banksNb + 1);
    }

    public function testGetBalancesNotOk()
    {
        $hsbc = $this->em->find('App:Bank', 1);

        $balances = $this->get('app.bank')->getBalances($this->jane, $hsbc);

        $this->assertEquals(count($balances), 0);
    }

    public function testGetBalancesOk()
    {
        $hsbc = $this->em->find('App:Bank', 1);

        $balances = $this->get('app.bank')->getBalances($this->john, $hsbc);

        $this->assertEquals(sprintf('%.2f', $balances['USD']), -17.10);
        $this->assertEquals(sprintf('%.2f', $balances['EUR']), 208.55);
    }
}
