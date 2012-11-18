<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Operation;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Operation
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationTest extends TestCase
{
    public function testFindAll()
    {
        $operations = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\Operation')->findAll();

        $this->assertEquals(count($operations), 14);
    }

    public function testOperation()
    {
        $operation = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Operation', 1);

        $this->assertEquals($operation->getThirdParty(), 'Third party 1');
        $this->assertEquals($operation->getTransferOperation()->getAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertEquals($operation->getTransferAccount()->getName(), 'John - HSBC - Certificate of deposit #1');
        $this->assertEquals($operation->getAccount()->getName(), 'John - HSBC - Checking account');
        $this->assertEquals($operation->getCategory()->getName(), 'Cat 2');
        $this->assertEquals($operation->getPaymentMethod()->getName(), 'transfer');
        $this->assertEquals($operation->getScheduler()->getThirdParty(), 'Third party 1');
    }
}
