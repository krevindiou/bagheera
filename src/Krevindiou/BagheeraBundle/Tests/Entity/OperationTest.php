<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\Operation;

class OperationTest extends TestCase
{
    public function testFindAll()
    {
        $operations = $this->em->getRepository('Model:Operation')->findAll();

        $this->assertEquals(count($operations), 14);
    }

    public function testOperation()
    {
        $operation = $this->em->find('Model:Operation', 1);

        $this->assertEquals($operation->getThirdParty(), 'Third party 1');
        $this->assertEquals($operation->getTransferOperation()->getAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertEquals($operation->getTransferAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertEquals($operation->getAccount()->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($operation->getCategory()->getName(), 'Cat 2');
        $this->assertEquals($operation->getPaymentMethod()->getName(), 'transfer');
        $this->assertEquals($operation->getScheduler()->getThirdParty(), 'Third party 1');
    }
}
