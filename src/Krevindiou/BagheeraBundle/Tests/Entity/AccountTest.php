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
        $accounts = self::$_em->getRepository('Krevindiou\BagheeraBundle\Entity\Account')->findAll();

        $this->assertEquals(count($accounts), 4);
    }

    public function testCheckingAccount1()
    {
        $checkingAccount1 = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Account', 1);

        $this->assertEquals($checkingAccount1->getName(), 'Checking account #1');
        $this->assertEquals($checkingAccount1->getBank()->getName(), 'HSBC');
        $this->assertEquals(count($checkingAccount1->getOperations()), 4);
        $this->assertEquals(count($checkingAccount1->getSchedulers()), 0);
    }

    public function testHomeSavingsAccount()
    {
        $homeSavingsAccount = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Account', 2);

        $this->assertEquals($homeSavingsAccount->getName(), 'Home savings account');
        $this->assertEquals($homeSavingsAccount->getBank()->getName(), 'HSBC');
        $this->assertEquals(count($homeSavingsAccount->getOperations()), 2);
        $this->assertEquals(count($homeSavingsAccount->getSchedulers()), 0);
    }

    public function testCheckingAccount2()
    {
        $checkingAccount2 = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Account', 3);

        $this->assertEquals($checkingAccount2->getName(), 'Checking account #2');
        $this->assertEquals($checkingAccount2->getBank()->getName(), 'Bank of America');
        $this->assertEquals(count($checkingAccount2->getOperations()), 2);
        $this->assertEquals(count($checkingAccount2->getSchedulers()), 0);
    }

    public function testSecuritiesAccount()
    {
        $securitiesAccount = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Account', 4);

        $this->assertEquals($securitiesAccount->getName(), 'Securities account');
        $this->assertEquals($securitiesAccount->getBank()->getName(), 'BNP Paribas');
        $this->assertEquals(count($securitiesAccount->getOperations()), 2);
        $this->assertEquals(count($securitiesAccount->getSchedulers()), 0);
    }
}
