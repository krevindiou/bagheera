<?php

namespace Tests\AppBundle\Entity;

use Tests\AppBundle\TestCase;
use AppBundle\Entity\Scheduler;

class SchedulerTest extends TestCase
{
    public function testFindAll()
    {
        $schedulers = $this->em->getRepository('AppBundle:Scheduler')->findAll();

        $this->assertEquals(count($schedulers), 3);
    }

    public function testScheduler()
    {
        $scheduler = $this->em->find('AppBundle:Scheduler', 1);

        $this->assertEquals($scheduler->getThirdParty(), 'Third party 1');
        $this->assertEquals($scheduler->getTransferAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertEquals($scheduler->getAccount()->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($scheduler->getCategory()->getName(), 'Cat 2');
        $this->assertEquals($scheduler->getPaymentMethod()->getName(), 'transfer');
    }
}
