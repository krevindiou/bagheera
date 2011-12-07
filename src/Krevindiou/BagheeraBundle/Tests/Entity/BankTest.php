<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
        $this->assertEquals($hsbc->getUser()->getFirstname(), 'John');
        $this->assertEquals(count($hsbc->getAccounts()), 2);
    }

    public function testBankOfAmerica()
    {
        $bankOfAmerica = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Bank', 2);

        $this->assertEquals($bankOfAmerica->getName(), 'Bank of America');
        $this->assertEquals($bankOfAmerica->getUser()->getFirstname(), 'John');
        $this->assertEquals(count($bankOfAmerica->getAccounts()), 1);
    }

    public function testBnpParibas()
    {
        $bnpParibas = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Bank', 3);

        $this->assertEquals($bnpParibas->getName(), 'BNP Paribas');
        $this->assertEquals($bnpParibas->getUser()->getFirstname(), 'Jane');
        $this->assertEquals(count($bnpParibas->getAccounts()), 1);
    }
}
