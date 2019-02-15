<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class SchedulerTest extends TestCase
{
    public function testFindAll(): void
    {
        $schedulers = $this->em->getRepository('App:Scheduler')->findAll();

        $this->assertSame(count($schedulers), 3);
    }

    public function testScheduler(): void
    {
        $scheduler = $this->em->find('App:Scheduler', 1);

        $this->assertSame($scheduler->getThirdParty(), 'Third party 1');
        $this->assertSame($scheduler->getTransferAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertSame($scheduler->getAccount()->getName(), 'John - HSBC - Checking account');
        $this->assertSame($scheduler->getCategory()->getName(), 'Cat 2');
        $this->assertSame($scheduler->getPaymentMethod()->getName(), 'transfer');
    }
}
