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
    Krevindiou\BagheeraBundle\Entity\Transaction;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Transaction
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class TransactionTest extends TestCase
{
    public function testFindAll()
    {
        $transactions = self::$_em->getRepository('Krevindiou\BagheeraBundle\Entity\Transaction')->findAll();

        $this->assertEquals(count($transactions), 10);
    }

    public function testTransaction()
    {
        $transaction = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Transaction', 1);

        $this->assertEquals($transaction->getThirdParty(), 'Third party 1');
        $this->assertEquals($transaction->getTransferTransaction()->getAccount()->getName(), 'Home savings account');
        $this->assertEquals($transaction->getAccount()->getName(), 'Checking account #1');
        $this->assertEquals($transaction->getCategory()->getName(), 'Cat 2');
        $this->assertEquals($transaction->getPaymentMethod()->getName(), 'transfer');
        $this->assertEquals($transaction->getScheduler(), null);
    }
}
