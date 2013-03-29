<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase;

class OperationSearchTest extends TestCase
{
    public function testFindAll()
    {
        $operationSearches = $this->em->getRepository('Krevindiou\BagheeraBundle\Entity\OperationSearch')->findAll();

        $this->assertEquals(count($operationSearches), 3);
    }

    public function testOperationSearch()
    {
        $operationSearch = $this->em->find('Krevindiou\BagheeraBundle\Entity\OperationSearch', 1);
        $this->assertEquals($operationSearch->getThirdParty(), 'Third party 1');

        $operationSearch = $this->em->find('Krevindiou\BagheeraBundle\Entity\OperationSearch', 2);
        $this->assertEquals(count($operationSearch->getCategories()), 1);
        $this->assertEquals($operationSearch->getCategories()->first()->getName(), 'Cat 2.1');

        $operationSearch = $this->em->find('Krevindiou\BagheeraBundle\Entity\OperationSearch', 3);
        $this->assertEquals(count($operationSearch->getPaymentMethods()), 1);
        $this->assertEquals($operationSearch->getPaymentMethods()->first()->getName(), 'credit_card');
    }
}
