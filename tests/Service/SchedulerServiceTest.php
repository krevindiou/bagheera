<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\Scheduler;
use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class SchedulerServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->john = $this->em->find('App:Member', 1);
        $this->jane = $this->em->find('App:Member', 2);
    }

    public function testGetFormForNewScheduler(): void
    {
        $account = $this->em->find('App:Account', 1);
        $form = $this->get('test.app.scheduler')->getForm(null, $account);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingScheduler(): void
    {
        $scheduler = $this->em->find('App:Scheduler', 1);
        $form = $this->get('test.app.scheduler')->getForm($scheduler);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewSchedulerWithNoData(): void
    {
        $scheduler = new Scheduler();
        $this->assertFalse($this->get('test.app.scheduler')->save($scheduler));
    }

    public function testSaveNewScheduler(): void
    {
        $scheduler = new Scheduler();
        $scheduler->setAccount($this->em->find('App:Account', 1));
        $scheduler->setThirdParty('Test');
        $scheduler->setDebit(1);
        $scheduler->setValueDate(new \DateTime());
        $scheduler->setPaymentMethod($this->em->find('App:PaymentMethod', 1));
        $scheduler->setFrequencyUnit('month');
        $scheduler->setFrequencyValue(1);
        $this->assertTrue($this->get('test.app.scheduler')->save($scheduler));
    }

    public function testSaveExistingSchedulerWithBadData(): void
    {
        $scheduler = $this->em->find('App:Scheduler', 1);
        $scheduler->setThirdParty('');
        $this->assertFalse($this->get('test.app.scheduler')->save($scheduler));
    }

    public function testSaveExistingScheduler(): void
    {
        $scheduler = $this->em->find('App:Scheduler', 1);
        $this->assertTrue($this->get('test.app.scheduler')->save($scheduler));
    }

    public function testGetSchedulers(): void
    {
        $account = $this->em->find('App:Account', 1);
        $schedulers = $this->get('test.app.scheduler')->getList($account);

        $this->assertSame(count($schedulers), 2);
    }

    public function testDelete(): void
    {
        $account = $this->em->find('App:Account', 1);

        $schedulersBeforeDelete = $this->get('test.app.scheduler')->getList($account);
        $countSchedulersBeforeDelete = count($schedulersBeforeDelete);

        $this->get('test.app.scheduler')->delete($this->em->find('App:Scheduler', 2));

        $schedulersAfterDelete = $this->get('test.app.scheduler')->getList($account);
        $countSchedulersAfterDelete = count($schedulersAfterDelete);

        $this->assertSame($countSchedulersAfterDelete, $countSchedulersBeforeDelete - 1);
    }

    public function testRunSchedulers(): void
    {
        $dql = 'SELECT o ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.scheduler = 1 ';
        $dql .= 'ORDER BY o.valueDate ASC ';
        $query = $this->em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $member = $this->em->find('App:Member', 1);
        $this->get('test.app.scheduler')->runSchedulers($member, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.scheduler = 1 ';
        $dql .= 'ORDER BY o.valueDate ASC ';
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

        $this->assertSame(count($newOperations), 5);
        $this->assertSame($newOperations[1], '2011-09-15');
        $this->assertSame($newOperations[2], '2011-09-29');
        $this->assertSame($newOperations[3], '2011-10-13');
        $this->assertSame($newOperations[4], '2011-10-27');
        $this->assertSame($newOperations[5], '2011-11-10');
    }

    public function testRunSchedulersWithFutureValueDate(): void
    {
        $dql = 'SELECT o ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.scheduler = 2 ';
        $query = $this->em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $member = $this->em->find('App:Member', 1);
        $this->get('test.app.scheduler')->runSchedulers($member, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.scheduler = 2 ';
        $query = $this->em->createQuery($dql);
        $operationsAfter = $query->getResult();

        $this->assertSame(count($operationsBefore), count($operationsAfter));
    }
}
