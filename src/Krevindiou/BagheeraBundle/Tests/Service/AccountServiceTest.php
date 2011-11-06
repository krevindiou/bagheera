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

        $request = new Request();

        $form = $this->get('bagheera.account')->getForm($account, $request);

        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveEmpty()
    {
        $account = new Account();

        $request = new Request();
        $request->setMethod('POST');

        $form = $this->get('bagheera.account')->getForm($account, $request);

        $ok = $this->get('bagheera.account')->save($form);

        $this->assertFalse($ok);
    }

    public function testSaveAddOk()
    {
        $bank = self::$_em->find('KrevindiouBagheeraBundle:Bank', 1);

        $account = new Account();
        $account->setBank($bank);

        $post = array(
            'krevindiou_bagheerabundle_accounttype' => array(
                'name' => 'Checking account #1',
                'initialBalance' => '0',
                'overdraftFacility' => '',
                'details' => '',
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.account')->getForm($account, $request);

        $ok = $this->get('bagheera.account')->save($form);

        $this->assertTrue($ok);
    }

    public function testSaveEditOk()
    {
        $account = self::$_em->find('KrevindiouBagheeraBundle:Account', 1);

        $post = array(
            'krevindiou_bagheerabundle_accounttype' => array(
                'name' => 'Checking account #1',
                'initialBalance' => '0',
                'overdraftFacility' => '',
                'details' => '',
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.account')->getForm($account, $request);

        $ok = $this->get('bagheera.account')->save($form);

        $this->assertTrue($ok);
    }

    public function testDelete()
    {
        $accounts = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->findAll();
        $this->assertEquals(count($accounts), 4);

        $account = self::$_em->find('KrevindiouBagheeraBundle:Account', 1);
        $ok = $this->get('bagheera.account')->delete($account);
        $this->assertTrue($ok);

        $accounts = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->findAll();
        $this->assertEquals(count($accounts), 3);
    }

    public function testGetBalance()
    {
        $account = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $balance = $this->get('bagheera.account')->getBalance($account);

        $this->assertEquals($balance, 102.07);
    }
}
