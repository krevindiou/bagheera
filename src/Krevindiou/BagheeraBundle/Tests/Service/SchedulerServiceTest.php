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
    Krevindiou\BagheeraBundle\Entity\Scheduler;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\SchedulerServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->_em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetFormForForeignUser()
    {
        $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', 1);
        $form = $this->get('bagheera.scheduler')->getForm($this->jane, $scheduler);
        $this->assertNull($form);
    }

    public function testGetFormForNewScheduler()
    {
        $form = $this->get('bagheera.scheduler')->getForm($this->john);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingScheduler()
    {
        $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', 1);
        $form = $this->get('bagheera.scheduler')->getForm($this->john, $scheduler);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewSchedulerWithNoData()
    {
        $scheduler = new Scheduler();
        $this->assertFalse($this->get('bagheera.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveNewSchedulerWithForeignAccount()
    {
        $scheduler = new Scheduler();
        $scheduler->setAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 4));
        $scheduler->setThirdParty('Test');
        $scheduler->setValueDate(new \DateTime());
        $scheduler->setPaymentMethod($this->_em->find('KrevindiouBagheeraBundle:PaymentMethod', 1));
        $scheduler->setFrequencyUnit('month');
        $scheduler->setFrequencyValue(1);
        $this->assertFalse($this->get('bagheera.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveNewScheduler()
    {
        $scheduler = new Scheduler();
        $scheduler->setAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 1));
        $scheduler->setThirdParty('Test');
        $scheduler->setValueDate(new \DateTime());
        $scheduler->setPaymentMethod($this->_em->find('KrevindiouBagheeraBundle:PaymentMethod', 1));
        $scheduler->setFrequencyUnit('month');
        $scheduler->setFrequencyValue(1);
        $this->assertTrue($this->get('bagheera.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveExistingSchedulerWithBadData()
    {
        $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', 1);
        $scheduler->setThirdParty('');
        $this->assertFalse($this->get('bagheera.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveExistingSchedulerWithForeignAccount()
    {
        $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', 1);
        $scheduler->setAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 4));
        $this->assertFalse($this->get('bagheera.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveExistingSchedulerWithForeignUser()
    {
        $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', 1);
        $this->assertFalse($this->get('bagheera.scheduler')->save($this->jane, $scheduler));
    }

    public function testSaveExistingScheduler()
    {
        $scheduler = $this->_em->find('KrevindiouBagheeraBundle:Scheduler', 1);
        $this->assertTrue($this->get('bagheera.scheduler')->save($this->john, $scheduler));
    }

    public function testGetSchedulers()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $schedulers = $this->get('bagheera.scheduler')->getSchedulers($this->john, $account);

        $this->assertEquals(count($schedulers), 2);
    }

    public function testDelete()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);

        $schedulersBeforeDelete = $this->get('bagheera.scheduler')->getSchedulers($this->john, $account);

        $schedulersId = array(2);
        $this->get('bagheera.scheduler')->delete($this->john, $schedulersId);

        $schedulersAfterDelete = $this->get('bagheera.scheduler')->getSchedulers($this->john, $account);

        $this->assertEquals(count($schedulersAfterDelete), count($schedulersBeforeDelete) - 1);
    }

    public function testRunSchedulers()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 1 ';
        $query = $this->_em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->get('bagheera.scheduler')->runSchedulers($user, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 1 ';
        $query = $this->_em->createQuery($dql);
        $operationsAfter = $query->getResult();


        $operationsBeforeDate = array();
        foreach ($operationsBefore as $operationBefore) {
            $operationsBeforeDate[] = $operationBefore->getValueDate()->format('Y-m-d');
        }

        $operationsAfterDate = array();
        foreach ($operationsAfter as $operationAfter) {
            $operationsAfterDate[] = $operationAfter->getValueDate()->format('Y-m-d');
        }

        $newOperations = array_diff($operationsAfterDate, $operationsBeforeDate);
        $this->assertEquals(count($newOperations), 5);
        $this->assertEquals($newOperations[1], '2011-09-15');
        $this->assertEquals($newOperations[2], '2011-09-29');
        $this->assertEquals($newOperations[3], '2011-10-13');
        $this->assertEquals($newOperations[4], '2011-10-27');
        $this->assertEquals($newOperations[5], '2011-11-10');
    }

    public function testRunSchedulersWithFutureValueDate()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 2 ';
        $query = $this->_em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $user = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->get('bagheera.scheduler')->runSchedulers($user, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 2 ';
        $query = $this->_em->createQuery($dql);
        $operationsAfter = $query->getResult();

        $this->assertEquals(count($operationsBefore), count($operationsAfter));
    }
}
