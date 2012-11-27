<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Bank;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Bank
 *
 */
class BankTest extends TestCase
{
    public function testFindAll()
    {
        $banks = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\Bank')->findAll();

        $this->assertEquals(count($banks), 5);
    }

    public function testHsbc()
    {
        $hsbc = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Bank', 1);

        $this->assertEquals($hsbc->getName(), 'HSBC');
        $this->assertEquals($hsbc->getUser()->getEmail(), 'john@example.net');
        $this->assertEquals(count($hsbc->getAccounts()), 4);
    }
}
