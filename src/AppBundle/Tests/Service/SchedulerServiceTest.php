<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Tests\Service;

use AppBundle\Tests\TestCase;
use AppBundle\Entity\Scheduler;

class SchedulerServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('Model:Member', 1);
        $this->jane = $this->em->find('Model:Member', 2);
    }

    public function testGetFormForForeignMember()
    {
        $scheduler = $this->em->find('Model:Scheduler', 1);
        $form = $this->get('app.scheduler')->getForm($this->jane, $scheduler);
        $this->assertNull($form);
    }

    public function testGetFormForNewScheduler()
    {
        $account = $this->em->find('Model:Account', 1);
        $form = $this->get('app.scheduler')->getForm($this->john, null, $account);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingScheduler()
    {
        $scheduler = $this->em->find('Model:Scheduler', 1);
        $form = $this->get('app.scheduler')->getForm($this->john, $scheduler);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewSchedulerWithNoData()
    {
        $scheduler = new Scheduler();
        $this->assertFalse($this->get('app.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveNewSchedulerWithForeignAccount()
    {
        $scheduler = new Scheduler();
        $scheduler->setAccount($this->em->find('Model:Account', 1));
        $scheduler->setThirdParty('Test');
        $scheduler->setValueDate(new \DateTime());
        $scheduler->setPaymentMethod($this->em->find('Model:PaymentMethod', 1));
        $scheduler->setFrequencyUnit('month');
        $scheduler->setFrequencyValue(1);
        $this->assertFalse($this->get('app.scheduler')->save($this->jane, $scheduler));
    }

    public function testSaveNewScheduler()
    {
        $scheduler = new Scheduler();
        $scheduler->setAccount($this->em->find('Model:Account', 1));
        $scheduler->setThirdParty('Test');
        $scheduler->setDebit(1);
        $scheduler->setValueDate(new \DateTime());
        $scheduler->setPaymentMethod($this->em->find('Model:PaymentMethod', 1));
        $scheduler->setFrequencyUnit('month');
        $scheduler->setFrequencyValue(1);
        $this->assertTrue($this->get('app.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveExistingSchedulerWithBadData()
    {
        $scheduler = $this->em->find('Model:Scheduler', 1);
        $scheduler->setThirdParty('');
        $this->assertFalse($this->get('app.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveExistingSchedulerWithForeignAccount()
    {
        $scheduler = $this->em->find('Model:Scheduler', 1);
        $scheduler->setAccount($this->em->find('Model:Account', 8));
        $this->assertFalse($this->get('app.scheduler')->save($this->john, $scheduler));
    }

    public function testSaveExistingSchedulerWithForeignMember()
    {
        $scheduler = $this->em->find('Model:Scheduler', 1);
        $this->assertFalse($this->get('app.scheduler')->save($this->jane, $scheduler));
    }

    public function testSaveExistingScheduler()
    {
        $scheduler = $this->em->find('Model:Scheduler', 1);
        $this->assertTrue($this->get('app.scheduler')->save($this->john, $scheduler));
    }

    public function testGetSchedulers()
    {
        $account = $this->em->find('Model:Account', 1);
        $schedulers = $this->get('app.scheduler')->getList($this->john, $account);

        $this->assertEquals(count($schedulers), 2);
    }

    public function testDelete()
    {
        $account = $this->em->find('Model:Account', 1);

        $schedulersBeforeDelete = $this->get('app.scheduler')->getList($this->john, $account);
        $countSchedulersBeforeDelete = count($schedulersBeforeDelete);

        $schedulersId = [2];
        $this->get('app.scheduler')->delete($this->john, $schedulersId);

        $schedulersAfterDelete = $this->get('app.scheduler')->getList($this->john, $account);
        $countSchedulersAfterDelete = count($schedulersAfterDelete);

        $this->assertEquals($countSchedulersAfterDelete, $countSchedulersBeforeDelete - 1);
    }

    public function testRunSchedulers()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM Model:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 1 ';
        $dql.= 'ORDER BY o.valueDate ASC ';
        $query = $this->em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $member = $this->em->find('Model:Member', 1);
        $this->get('app.scheduler')->runSchedulers($member, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql.= 'FROM Model:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 1 ';
        $dql.= 'ORDER BY o.valueDate ASC ';
        $query = $this->em->createQuery($dql);
        $operationsAfter = $query->getResult();

        $operationsBeforeDate = [];
        foreach ($operationsBefore as $operationBefore) {
            $operationsBeforeDate[] = $operationBefore->getValueDate()->format('Y-m-d');
        }

        $operationsAfterDate = [];
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
        $dql.= 'FROM Model:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 2 ';
        $query = $this->em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $member = $this->em->find('Model:Member', 1);
        $this->get('app.scheduler')->runSchedulers($member, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql.= 'FROM Model:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 2 ';
        $query = $this->em->createQuery($dql);
        $operationsAfter = $query->getResult();

        $this->assertEquals(count($operationsBefore), count($operationsAfter));
    }
}
