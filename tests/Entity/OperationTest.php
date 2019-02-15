<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class OperationTest extends TestCase
{
    public function testFindAll(): void
    {
        $operations = $this->em->getRepository('App:Operation')->findAll();

        $this->assertSame(count($operations), 14);
    }

    public function testOperation(): void
    {
        $operation = $this->em->find('App:Operation', 1);

        $this->assertSame($operation->getThirdParty(), 'Third party 1');
        $this->assertSame($operation->getTransferOperation()->getAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertSame($operation->getTransferAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertSame($operation->getAccount()->getName(), 'John - HSBC - Checking account');
        $this->assertSame($operation->getCategory()->getName(), 'Cat 2');
        $this->assertSame($operation->getPaymentMethod()->getName(), 'transfer');
        $this->assertSame($operation->getScheduler()->getThirdParty(), 'Third party 1');
    }
}
