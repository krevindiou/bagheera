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
    Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\AccountServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->_em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetFormNotOk()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 4);
        $form = $this->get('bagheera.account')->getForm($this->john, $account);
        $this->assertNull($form);
    }

    public function testGetFormOk()
    {
        $form = $this->get('bagheera.account')->getForm($this->john);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');

        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $form = $this->get('bagheera.account')->getForm($this->john, $account);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveAddNotOk()
    {
        $account = new Account();
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));

        $account = new Account();
        $account->setBank($this->_em->find('KrevindiouBagheeraBundle:Bank', 3));
        $account->setName('Checking account #1');
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveAddOk()
    {
        $account = new Account();
        $account->setBank($this->_em->find('KrevindiouBagheeraBundle:Bank', 1));
        $account->setName('Checking account #1');
        $this->assertTrue($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveEditNotOk()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $account->setName('');
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));

        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $account->setBank($this->_em->find('KrevindiouBagheeraBundle:Bank', 3));
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));

        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 4);
        $this->assertFalse($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testSaveEditOk()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $this->assertTrue($this->get('bagheera.account')->save($this->john, $account));
    }

    public function testDelete()
    {
        $accounts = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->findAll();
        $accountsNb = count($accounts);

        $this->assertTrue($this->get('bagheera.account')->delete($this->john, array(1)));

        $accounts = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->findAll();
        $this->assertEquals(count($accounts), $accountsNb - 1);
    }

    public function testGetBalanceNotOk()
    {
        $account = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->find(4);

        $balance = $this->get('bagheera.account')->getBalance($this->john, $account);

        $this->assertEquals($balance, 0);
    }

    public function testGetBalanceOk()
    {
        $account = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $balance = $this->get('bagheera.account')->getBalance($this->john, $account);

        $this->assertEquals($balance, 102.07);
    }
}
