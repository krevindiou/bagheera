<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Scheduler;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Scheduler
 *
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
        $this->assertEquals($scheduler->getTransferAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertEquals($scheduler->getAccount()->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($scheduler->getCategory()->getName(), 'Cat 2');
        $this->assertEquals($scheduler->getPaymentMethod()->getName(), 'transfer');
    }
}
