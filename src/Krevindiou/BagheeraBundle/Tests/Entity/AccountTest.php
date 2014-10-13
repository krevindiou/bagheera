<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\Account;

class AccountTest extends TestCase
{
    public function testFindAll()
    {
        $accounts = $this->em->getRepository('Model:Account')->findAll();

        $this->assertEquals(count($accounts), 8);
    }

    public function testCheckingAccount()
    {
        $checkingAccount1 = $this->em->find('Model:Account', 1);

        $this->assertEquals($checkingAccount1->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($checkingAccount1->getBank()->getName(), 'HSBC');
        $this->assertEquals(count($checkingAccount1->getOperations()), 4);
        $this->assertEquals(count($checkingAccount1->getSchedulers()), 2);
    }
}
