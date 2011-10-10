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
    Krevindiou\BagheeraBundle\Service\BankService,
    Krevindiou\BagheeraBundle\Entity\Bank;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\BankServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankServiceTest extends TestCase
{
    public function testGetForm()
    {
        $bank = new Bank();

        $request = new Request();

        $form = $this->get('bagheera.bank')->getForm($bank, $request);

        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveEmpty()
    {
        $bank = new Bank();
        $bank->setUser(self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1));

        $request = new Request();
        $request->setMethod('POST');

        $form = $this->get('bagheera.bank')->getForm($bank, $request);

        $ok = $this->get('bagheera.bank')->save($form);

        $this->assertFalse($ok);
    }

    public function testSaveAddOk()
    {
        $bank = new Bank();
        $bank->setUser(self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1));

        $post = array(
            'krevindiou_bagheerabundle_banktype' => array(
                'name' => 'Citigroup',
                'info' => '',
                'contact' => '',
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.bank')->getForm($bank, $request);

        $ok = $this->get('bagheera.bank')->save($form);

        $this->assertTrue($ok);
    }

    public function testSaveEditOk()
    {
        $bank = self::$_em->find('KrevindiouBagheeraBundle:Bank', 1);

        $post = array(
            'krevindiou_bagheerabundle_banktype' => array(
                'name' => 'HSBC',
                'info' => '',
                'contact' => '',
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.bank')->getForm($bank, $request);

        $ok = $this->get('bagheera.bank')->save($form);

        $this->assertTrue($ok);
    }

    public function testDelete()
    {
        $banks = self::$_em->getRepository('KrevindiouBagheeraBundle:Bank')->findAll();
        $this->assertEquals(count($banks), 3);

        $bank = self::$_em->find('KrevindiouBagheeraBundle:Bank', 1);
        $ok = $this->get('bagheera.bank')->delete($bank);
        $this->assertTrue($ok);

        $banks = self::$_em->getRepository('KrevindiouBagheeraBundle:Bank')->findAll();
        $this->assertEquals(count($banks), 2);
    }
}
