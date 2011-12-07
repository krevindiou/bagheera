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
    Krevindiou\BagheeraBundle\Entity\Scheduler;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Scheduler
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerTest extends TestCase
{
    public function testFindAll()
    {
        $schedulers = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\Scheduler')->findAll();

        $this->assertEquals(count($schedulers), 3);
    }

    public function testScheduler()
    {
        $scheduler = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Scheduler', 1);

        $this->assertEquals($scheduler->getThirdParty(), 'Third party 1');
        $this->assertEquals($scheduler->getTransferAccount()->getName(), 'Home savings account');
        $this->assertEquals($scheduler->getAccount()->getName(), 'Checking account #1');
        $this->assertEquals($scheduler->getCategory()->getName(), 'Cat 2');
        $this->assertEquals($scheduler->getPaymentMethod()->getName(), 'transfer');
    }
}
