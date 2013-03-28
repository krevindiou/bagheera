<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\OperationSearch;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\OperationSearchServiceTest
 *
 */
class OperationSearchServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetFormForForeignUser()
    {
        $operationSearch = $this->em->find('KrevindiouBagheeraBundle:OperationSearch', 1);
        $form = $this->get('bagheera.operation_search')->getForm($this->jane, $operationSearch);
        $this->assertNull($form);
    }

    public function testGetFormForNewOperation()
    {
        $account = $this->em->find('KrevindiouBagheeraBundle:Account', 1);
        $form = $this->get('bagheera.operation_search')->getForm($this->john, null, $account);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingOperation()
    {
        $operationSearch = $this->em->find('KrevindiouBagheeraBundle:OperationSearch', 1);
        $form = $this->get('bagheera.operation_search')->getForm($this->john, $operationSearch);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }
}
