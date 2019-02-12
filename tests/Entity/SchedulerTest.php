<?php

namespace App\Tests\Entity;

use App\Tests\TestCase;
use App\Entity\Scheduler;

class SchedulerTest extends TestCase
{
    public function testFindAll()
    {
        $schedulers = $this->em->getRepository('App:Scheduler')->findAll();

        $this->assertEquals(count($schedulers), 3);
    }

    public function testScheduler()
    {
        $scheduler = $this->em->find('App:Scheduler', 1);

        $this->assertEquals($scheduler->getThirdParty(), 'Third party 1');
        $this->assertEquals($scheduler->getTransferAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertEquals($scheduler->getAccount()->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($scheduler->getCategory()->getName(), 'Cat 2');
        $this->assertEquals($scheduler->getPaymentMethod()->getName(), 'transfer');
    }
}
