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

use Symfony\Component\HttpFoundation\Request,
    Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\AccountServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountServiceTest extends TestCase
{
    public function testGetForm()
    {
        $account = new Account();

        $form = $this->get('bagheera.account')->getForm($account);

        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveEmpty()
    {
        $account = new Account();

        $form = $this->get('bagheera.account')->getForm($account);

        $ok = $this->get('bagheera.account')->save($form);

        $this->assertFalse($ok);
    }

    public function testSaveAddOk()
    {
        $bank = $this->_em->find('KrevindiouBagheeraBundle:Bank', 1);

        $account = new Account();
        $account->setBank($bank);

        $values = array(
            'name' => 'Checking account #1',
            'initialBalance' => '0',
            'overdraftFacility' => '',
            'details' => '',
        );

        $form = $this->get('bagheera.account')->getForm($account, $values);

        $ok = $this->get('bagheera.account')->save($form);

        $this->assertTrue($ok);
    }

    public function testSaveEditOk()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);

        $values = array(
            'name' => 'Checking account #1',
            'initialBalance' => '0',
            'overdraftFacility' => '',
            'details' => '',
        );

        $form = $this->get('bagheera.account')->getForm($account, $values);

        $ok = $this->get('bagheera.account')->save($form);

        $this->assertTrue($ok);
    }

    public function testDelete()
    {
        $accounts = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->findAll();
        $this->assertEquals(count($accounts), 4);

        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $ok = $this->get('bagheera.account')->delete($account);
        $this->assertTrue($ok);

        $accounts = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->findAll();
        $this->assertEquals(count($accounts), 3);
    }

    public function testGetBalance()
    {
        $account = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $balance = $this->get('bagheera.account')->getBalance($account);

        $this->assertEquals($balance, 102.07);
    }
}
