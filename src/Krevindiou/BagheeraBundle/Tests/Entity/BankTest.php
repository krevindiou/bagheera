<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\Bank;

class BankTest extends TestCase
{
    public function testFindAll()
    {
        $banks = $this->em->getRepository('Model:Bank')->findAll();

        $this->assertEquals(count($banks), 5);
    }

    public function testHsbc()
    {
        $hsbc = $this->em->find('Model:Bank', 1);

        $this->assertEquals($hsbc->getName(), 'HSBC');
        $this->assertEquals($hsbc->getMember()->getEmail(), 'john@example.net');
        $this->assertEquals(count($hsbc->getAccounts()), 4);
    }
}
