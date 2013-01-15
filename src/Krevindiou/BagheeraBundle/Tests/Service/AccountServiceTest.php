<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\AccountServiceTest
 *
 */
class AccountServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->_em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetFormForForeignUser()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $form = $this->get('bagheera.account')->getEditForm($this->jane, $account);
        $this->assertNull($form);
    }

    public function testGetFormForNewAccount()
    {
        $hsbc = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Bank', 1);

        $form = $this->get('bagheera.account')->getNewForm($this->john, $hsbc);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingAccount()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
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
        $account->setBank($this->_em->find('KrevindiouBagheeraBundle:Bank', 5));
        $account->setName('Checking account #1');
        $account->setCurrency('USD');
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveNewAccount()
    {
        $account = new Account();
        $account->setBank($this->_em->find('KrevindiouBagheeraBundle:Bank', 1));
        $account->setName('Checking account #1');
        $account->setCurrency('USD');
        $this->assertTrue($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithBadData()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $account->setName('');
        $account->setCurrency('USD');
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithForeignBank()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $account->setBank($this->_em->find('KrevindiouBagheeraBundle:Bank', 5));
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveExistingAccountWithForeignUser()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $this->assertFalse($this->get('bagheera.account')->save($this->jane, $account));
    }

    public function testSaveExistingAccount()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $this->assertTrue($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testDelete()
    {
        $accounts = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->findByIsDeleted(true);
        $accountsNb = count($accounts);

        $this->assertTrue($this->get('bagheera.account')->delete($this->john, array(1)));

        $accounts = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->findByIsDeleted(true);
        $this->assertEquals(count($accounts), $accountsNb + 1);
    }

    public function testGetBalanceNotOk()
    {
        $account = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $balance = $this->get('bagheera.account')->getBalance($this->jane, $account);

        $this->assertEquals($balance, 0);
    }

    public function testGetBalanceOk()
    {
        $account = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $balance = $this->get('bagheera.account')->getBalance($this->john, $account);

        $this->assertEquals($balance, -21.49);
    }

    public function testSynthesis()
    {
        $expectedData = array(
            'USD' => array(
                strtotime('2011-01-01') * 1000 => 0,
                strtotime('2011-02-01') * 1000 => 0,
                strtotime('2011-03-01') * 1000 => 0,
                strtotime('2011-04-01') * 1000 => 0,
                strtotime('2011-05-01') * 1000 => 0,
                strtotime('2011-06-01') * 1000 => 0,
                strtotime('2011-07-01') * 1000 => 0,
                strtotime('2011-08-01') * 1000 => 0,
                strtotime('2011-09-01') * 1000 => -137.13,
                strtotime('2011-10-01') * 1000 => -98.82,
                strtotime('2011-11-01') * 1000 => -98.82,
                strtotime('2011-12-01') * 1000 => -98.82
            ),
            'EUR' => array(
                strtotime('2011-01-01') * 1000 => 0,
                strtotime('2011-02-01') * 1000 => 0,
                strtotime('2011-03-01') * 1000 => 0,
                strtotime('2011-04-01') * 1000 => 0,
                strtotime('2011-05-01') * 1000 => 0,
                strtotime('2011-06-01') * 1000 => 0,
                strtotime('2011-07-01') * 1000 => 0,
                strtotime('2011-08-01') * 1000 => 0,
                strtotime('2011-09-01') * 1000 => 208.55,
                strtotime('2011-10-01') * 1000 => 208.55,
                strtotime('2011-11-01') * 1000 => 208.55,
                strtotime('2011-12-01') * 1000 => 208.55
            )
        );

        $data = $this->get('bagheera.report')->getSynthesis(
            $this->john,
            new \DateTime('2011-01-01'),
            new \DateTime('2011-12-31')
        );

        $this->assertEquals($data['points']['USD'], $expectedData['USD']);
        $this->assertEquals($data['points']['EUR'], $expectedData['EUR']);
    }
}
