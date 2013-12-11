<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\Account;

class AccountServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('KrevindiouBagheeraBundle:Member', 1);
        $this->jane = $this->em->find('KrevindiouBagheeraBundle:Member', 2);
    }

    public function testGetFormForForeignMember()
    {
        $account = $this->em->find('KrevindiouBagheeraBundle:Account', 1);
        $form = $this->get('bagheera.account')->getEditForm($this->jane, $account);
        $this->assertNull($form);
    }

    public function testGetFormForNewAccount()
    {
        $hsbc = $this->em->find('Krevindiou\BagheeraBundle\Entity\Bank', 1);

        $form = $this->get('bagheera.account')->getNewForm($this->john, $hsbc);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingAccount()
    {
        $account = $this->em->find('KrevindiouBagheeraBundle:Account', 1);
        $form = $this->get('bagheera.account')->getEditForm($this->john, $account);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewAccountWithNoData()
    {
        $account = new Account();
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveNewAccountWithForeignBank()
    {
        $account = new Account();
        $account->setBank($this->em->find('KrevindiouBagheeraBundle:Bank', 5));
        $account->setName('Checking account #1');
        $account->setCurrency('USD');
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveNewAccount()
    {
        $account = new Account();
        $account->setBank($this->em->find('KrevindiouBagheeraBundle:Bank', 1));
        $account->setName('Checking account #1');
        $account->setCurrency('USD');
        $this->assertTrue($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithBadData()
    {
        $account = $this->em->find('KrevindiouBagheeraBundle:Account', 1);
        $account->setName('');
        $account->setCurrency('USD');
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithForeignBank()
    {
        $account = $this->em->find('KrevindiouBagheeraBundle:Account', 1);
        $account->setBank($this->em->find('KrevindiouBagheeraBundle:Bank', 5));
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithForeignMember()
    {
        $account = $this->em->find('KrevindiouBagheeraBundle:Account', 1);
        $this->assertFalse($this->get('bagheera.account')->save($this->jane, $account));
    }

    public function testSaveExistingAccount()
    {
        $account = $this->em->find('KrevindiouBagheeraBundle:Account', 1);
        $this->assertTrue($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testDelete()
    {
        $accounts = $this->em->getRepository('KrevindiouBagheeraBundle:Account')->findByDeleted(true);
        $accountsNb = count($accounts);

        $this->assertTrue($this->get('bagheera.account')->delete($this->john, [1]));

        $accounts = $this->em->getRepository('KrevindiouBagheeraBundle:Account')->findByDeleted(true);
        $this->assertEquals(count($accounts), $accountsNb + 1);
    }

    public function testGetBalanceNotOk()
    {
        $account = $this->em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $balance = $this->get('bagheera.account')->getBalance($this->jane, $account);

        $this->assertEquals($balance, 0);
    }

    public function testGetBalanceOk()
    {
        $account = $this->em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $balance = $this->get('bagheera.account')->getBalance($this->john, $account);

        $this->assertEquals($balance, -21.49);
    }

    public function testSynthesis()
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
                strtotime('2011-09-01 UTC') => -137.13,
                strtotime('2011-10-01 UTC') => -98.82,
                strtotime('2011-11-01 UTC') => -98.82,
                strtotime('2011-12-01 UTC') => -98.82
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
                strtotime('2011-09-01 UTC') => 208.55,
                strtotime('2011-10-01 UTC') => 208.55,
                strtotime('2011-11-01 UTC') => 208.55,
                strtotime('2011-12-01 UTC') => 208.55
            ]
        ];

        $data = $this->get('bagheera.report')->getSynthesis(
            $this->john,
            new \DateTime('2011-01-01'),
            new \DateTime('2011-12-31')
        );

        $this->assertEquals($data['points']['USD'], $expectedData['USD']);
        $this->assertEquals($data['points']['EUR'], $expectedData['EUR']);
    }
}
