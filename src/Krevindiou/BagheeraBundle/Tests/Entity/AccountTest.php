<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Account
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountTest extends TestCase
{
    public function testFindAll()
    {
        $accounts = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\Account')->findAll();

        $this->assertEquals(count($accounts), 8);
    }

    public function testCheckingAccount()
    {
        $checkingAccount1 = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Account', 1);

        $this->assertEquals($checkingAccount1->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($checkingAccount1->getBank()->getName(), 'HSBC');
        $this->assertEquals(count($checkingAccount1->getOperations()), 4);
        $this->assertEquals(count($checkingAccount1->getSchedulers()), 2);
    }
}
