<?php

namespace AppBundle\Tests\Entity;

use AppBundle\Tests\TestCase;
use AppBundle\Entity\Account;

class AccountTest extends TestCase
{
    public function testFindAll()
    {
        $accounts = $this->em->getRepository('AppBundle:Account')->findAll();

        $this->assertEquals(count($accounts), 8);
    }

    public function testCheckingAccount()
    {
        $checkingAccount1 = $this->em->find('AppBundle:Account', 1);

        $this->assertEquals($checkingAccount1->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($checkingAccount1->getBank()->getName(), 'HSBC');
        $this->assertEquals(count($checkingAccount1->getOperations()), 4);
        $this->assertEquals(count($checkingAccount1->getSchedulers()), 2);
    }
}
