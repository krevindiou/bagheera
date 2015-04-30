<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Tests\Service;

use AppBundle\Tests\TestCase;
use AppBundle\Entity\Operation;

class OperationServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->em->find('AppBundle:Member', 1);
        $this->jane = $this->em->find('AppBundle:Member', 2);
    }

    public function testGetFormForForeignMember()
    {
        $operation = $this->em->find('AppBundle:Operation', 1);
        $form = $this->get('app.operation')->getForm($this->jane, $operation);
        $this->assertNull($form);
    }

    public function testGetFormForNewOperation()
    {
        $account = $this->em->find('AppBundle:Account', 1);
        $form = $this->get('app.operation')->getForm($this->john, null, $account);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingOperation()
    {
        $operation = $this->em->find('AppBundle:Operation', 1);
        $form = $this->get('app.operation')->getForm($this->john, $operation);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewOperationWithNoData()
    {
        $operation = new Operation();
        $this->assertFalse($this->get('app.operation')->save($this->john, $operation));
    }

    public function testSaveNewOperationWithForeignAccount()
    {
        $operation = new Operation();
        $operation->setAccount($this->em->find('AppBundle:Account', 1));
        $operation->setThirdParty('Test');
        $operation->setValueDate(new \DateTime());
        $operation->setPaymentMethod($this->em->find('AppBundle:PaymentMethod', 1));
        $this->assertFalse($this->get('app.operation')->save($this->jane, $operation));
    }

    public function testSaveNewOperation()
    {
        $operation = new Operation();
        $operation->setAccount($this->em->find('AppBundle:Account', 1));
        $operation->setThirdParty('Test');
        $operation->setDebit(1);
        $operation->setValueDate(new \DateTime());
        $operation->setPaymentMethod($this->em->find('AppBundle:PaymentMethod', 1));
        $this->assertTrue($this->get('app.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithBadData()
    {
        $operation = $this->em->find('AppBundle:Operation', 1);
        $operation->setThirdParty('');
        $this->assertFalse($this->get('app.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithForeignAccount()
    {
        $operation = $this->em->find('AppBundle:Operation', 1);
        $operation->setAccount($this->em->find('AppBundle:Account', 8));
        $this->assertFalse($this->get('app.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithForeignMember()
    {
        $operation = $this->em->find('AppBundle:Operation', 1);
        $this->assertFalse($this->get('app.operation')->save($this->jane, $operation));
    }

    public function testSaveExistingOperation()
    {
        $operation = $this->em->find('AppBundle:Operation', 1);
        $this->assertTrue($this->get('app.operation')->save($this->john, $operation));
    }

    public function testEditAndRemoveTransfer()
    {
        $operation = $this->em->find('AppBundle:Operation', 2);
        $operation->setTransferAccount(null);
        $operation->setPaymentMethod($this->em->find('AppBundle:PaymentMethod', 5));

        $this->assertTrue($this->get('app.operation')->save($this->john, $operation));

        $this->em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->em->find('AppBundle:Operation', 2);
        $this->assertNull($operation->getTransferOperation());
        $this->assertNull($operation->getTransferAccount());
    }

    public function testEditAndChangeTransfer()
    {
        $operation = $this->em->find('AppBundle:Operation', 1);
        $operation->setTransferAccount($this->em->find('AppBundle:Account', 3));

        $this->assertTrue($this->get('app.operation')->save($this->john, $operation));

        $this->em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->em->find('AppBundle:Operation', 1);
        $this->assertEquals($operation->getTransferOperation()->getOperationId(), 5);
        $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        $this->assertEquals($operation->getTransferAccount()->getAccountId(), 3);
    }

    public function testEditAndSetTransfer()
    {
        $operation = $this->em->find('AppBundle:Operation', 2);
        $operation->setTransferAccount($this->em->find('AppBundle:Account', 3));
        $operation->setPaymentMethod($this->em->find('AppBundle:PaymentMethod', 4));

        $this->assertTrue($this->get('app.operation')->save($this->john, $operation));

        $this->em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->em->find('AppBundle:Operation', 2);
        $this->assertEquals($operation->getTransferOperation()->getOperationId(), 15);
        $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        $this->assertEquals($operation->getTransferAccount()->getAccountId(), 3);
    }

    public function testGetOperations()
    {
        $account = $this->em->find('AppBundle:Account', 1);
        $operations = $this->get('app.operation')->getList($this->john, $account);

        $this->assertEquals(count($operations), 4);
    }

    public function testDelete()
    {
        $account = $this->em->find('AppBundle:Account', 1);

        $operationsBeforeDelete = $this->get('app.operation')->getList($this->john, $account);
        $countOperationsBeforeDelete = count($operationsBeforeDelete);

        $operationsId = [1, 3];
        $this->get('app.operation')->delete($this->john, $operationsId);

        $operationsAfterDelete = $this->get('app.operation')->getList($this->john, $account);
        $countOperationsAfterDelete = count($operationsAfterDelete);

        $this->assertEquals($countOperationsAfterDelete, $countOperationsBeforeDelete - 2);
    }

    public function testReconcile()
    {
        $dql = 'SELECT COUNT(o) ';
        $dql .= 'FROM AppBundle:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.reconciled = true ';
        $query = $this->em->createQuery($dql);
        $operationsBeforeReconcile = $query->getSingleScalarResult();

        $operationsId = [1];
        $this->get('app.operation')->reconcile($this->john, $operationsId);

        $dql = 'SELECT COUNT(o) ';
        $dql .= 'FROM AppBundle:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.reconciled = true ';
        $query = $this->em->createQuery($dql);
        $operationsAfterReconcile = $query->getSingleScalarResult();

        $this->assertEquals($operationsAfterReconcile, $operationsBeforeReconcile + 1);
    }
}
