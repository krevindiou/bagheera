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

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Bank;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\BankServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->_em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetFormNotOk()
    {
        $bnp = $this->_em->find('KrevindiouBagheeraBundle:Bank', 3);
        $form = $this->get('bagheera.bank')->getForm($this->john, $bnp);
        $this->assertNull($form);
    }

    public function testGetFormOk()
    {
        $form = $this->get('bagheera.bank')->getForm($this->john);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');

        $hsbc = $this->_em->find('KrevindiouBagheeraBundle:Bank', 1);
        $form = $this->get('bagheera.bank')->getForm($this->john, $hsbc);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveAddNotOk()
    {
        $bank = new Bank();
        $this->assertFalse($this->get('bagheera.bank')->save($this->john, $bank));

        $bank = new Bank();
        $bank->setUser($this->jane);
        $bank->setName('Citigroup');
        $this->assertFalse($this->get('bagheera.bank')->save($this->john, $bank));
    }

    public function testSaveAddOk()
    {
        $bank = new Bank();
        $bank->setUser($this->john);
        $bank->setName('Citigroup');
        $this->assertTrue($this->get('bagheera.bank')->save($this->john, $bank));
    }

    public function testSaveEditNotOk()
    {
        $hsbc = $this->_em->find('KrevindiouBagheeraBundle:Bank', 1);
        $hsbc->setName('');
        $this->assertFalse($this->get('bagheera.bank')->save($this->john, $hsbc));

        $bnp = $this->_em->find('KrevindiouBagheeraBundle:Bank', 3);
        $this->assertFalse($this->get('bagheera.bank')->save($this->john, $bnp));
    }

    public function testSaveEditOk()
    {
        $hsbc = $this->_em->find('KrevindiouBagheeraBundle:Bank', 1);
        $this->assertTrue($this->get('bagheera.bank')->save($this->john, $hsbc));
    }

    public function testDelete()
    {
        $banks = $this->_em->getRepository('KrevindiouBagheeraBundle:Bank')->findAll();
        $banksNb = count($banks);

        $this->assertTrue($this->get('bagheera.bank')->delete($this->john, array(1)));

        $banks = $this->_em->getRepository('KrevindiouBagheeraBundle:Bank')->findAll();
        $this->assertEquals(count($banks), $banksNb - 1);
    }

    public function testGetBalanceNotOk()
    {
        $bnp = $this->_em->find('KrevindiouBagheeraBundle:Bank', 3);

        $balance = $this->get('bagheera.bank')->getBalance($this->john, $bnp);

        $this->assertEquals($balance, 0);
    }

    public function testGetBalanceOk()
    {
        $hsbc = $this->_em->find('KrevindiouBagheeraBundle:Bank', 1);

        $balance = $this->get('bagheera.bank')->getBalance($this->john, $hsbc);

        $this->assertEquals($balance, 205.46);
    }
}
