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
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankTest extends TestCase
{
    public function testFindAll()
    {
        $banks = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\Bank')->findAll();

        $this->assertEquals(count($banks), 3);
    }

    public function testHsbc()
    {
        $hsbc = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Bank', 1);

        $this->assertEquals($hsbc->getName(), 'HSBC');
        $this->assertEquals($hsbc->getUser()->getEmail(), 'john@example.net');
        $this->assertEquals(count($hsbc->getAccounts()), 2);
    }

    public function testBankOfAmerica()
    {
        $bankOfAmerica = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Bank', 2);

        $this->assertEquals($bankOfAmerica->getName(), 'Bank of America');
        $this->assertEquals($bankOfAmerica->getUser()->getEmail(), 'john@example.net');
        $this->assertEquals(count($bankOfAmerica->getAccounts()), 1);
    }

    public function testBnpParibas()
    {
        $bnpParibas = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Bank', 3);

        $this->assertEquals($bnpParibas->getName(), 'BNP Paribas');
        $this->assertEquals($bnpParibas->getUser()->getEmail(), 'jane@example.net');
        $this->assertEquals(count($bnpParibas->getAccounts()), 1);
    }
}
