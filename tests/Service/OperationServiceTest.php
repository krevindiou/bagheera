<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\Operation;
use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class OperationServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->john = $this->em->find('App:Member', 1);
        $this->jane = $this->em->find('App:Member', 2);
    }

    public function testGetFormForForeignMember(): void
    {
        $operation = $this->em->find('App:Operation', 1);
        $form = $this->get('test.app.operation')->getForm($this->jane, $operation);
        $this->assertNull($form);
    }

    public function testGetFormForNewOperation(): void
    {
        $account = $this->em->find('App:Account', 1);
        $form = $this->get('test.app.operation')->getForm($this->john, null, $account);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingOperation(): void
    {
        $operation = $this->em->find('App:Operation', 1);
        $form = $this->get('test.app.operation')->getForm($this->john, $operation);
        $this->assertSame(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewOperationWithNoData(): void
    {
        $operation = new Operation();
        $this->assertFalse($this->get('test.app.operation')->save($this->john, $operation));
    }

    public function testSaveNewOperationWithForeignAccount(): void
    {
        $operation = new Operation();
        $operation->setAccount($this->em->find('App:Account', 1));
        $operation->setThirdParty('Test');
        $operation->setValueDate(new \DateTime());
        $operation->setPaymentMethod($this->em->find('App:PaymentMethod', 1));
        $this->assertFalse($this->get('test.app.operation')->save($this->jane, $operation));
    }

    public function testSaveNewOperation(): void
    {
        $operation = new Operation();
        $operation->setAccount($this->em->find('App:Account', 1));
        $operation->setThirdParty('Test');
        $operation->setDebit(1);
        $operation->setValueDate(new \DateTime());
        $operation->setPaymentMethod($this->em->find('App:PaymentMethod', 1));
        $this->assertTrue($this->get('test.app.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithBadData(): void
    {
        $operation = $this->em->find('App:Operation', 1);
        $operation->setThirdParty('');
        $this->assertFalse($this->get('test.app.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithForeignAccount(): void
    {
        $operation = $this->em->find('App:Operation', 1);
        $operation->setAccount($this->em->find('App:Account', 8));
        $this->assertFalse($this->get('test.app.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithForeignMember(): void
    {
        $operation = $this->em->find('App:Operation', 1);
        $this->assertFalse($this->get('test.app.operation')->save($this->jane, $operation));
    }

    public function testSaveExistingOperation(): void
    {
        $operation = $this->em->find('App:Operation', 1);
        $this->assertTrue($this->get('test.app.operation')->save($this->john, $operation));
    }

    public function testEditAndRemoveTransfer(): void
    {
        $operation = $this->em->find('App:Operation', 2);
        $operation->setTransferAccount(null);
        $operation->setPaymentMethod($this->em->find('App:PaymentMethod', 5));

        $this->assertTrue($this->get('test.app.operation')->save($this->john, $operation));

        $this->em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->em->find('App:Operation', 2);
        $this->assertNull($operation->getTransferOperation());
        $this->assertNull($operation->getTransferAccount());
    }

    public function testEditAndChangeTransfer(): void
    {
        $operation = $this->em->find('App:Operation', 1);
        $operation->setTransferAccount($this->em->find('App:Account', 3));

        $this->assertTrue($this->get('test.app.operation')->save($this->john, $operation));

        $this->em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->em->find('App:Operation', 1);
        $this->assertSame($operation->getTransferOperation()->getOperationId(), 5);
        $this->assertSame($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        $this->assertSame($operation->getTransferAccount()->getAccountId(), 3);
    }

    public function testEditAndSetTransfer(): void
    {
        $operation = $this->em->find('App:Operation', 2);
        $operation->setTransferAccount($this->em->find('App:Account', 3));
        $operation->setPaymentMethod($this->em->find('App:PaymentMethod', 4));

        $this->assertTrue($this->get('test.app.operation')->save($this->john, $operation));

        $this->em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->em->find('App:Operation', 2);
        $this->assertSame($operation->getTransferOperation()->getOperationId(), 15);
        $this->assertSame($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        $this->assertSame($operation->getTransferAccount()->getAccountId(), 3);
    }

    public function testGetOperations(): void
    {
        $account = $this->em->find('App:Account', 1);
        $operations = $this->get('test.app.operation')->getList($this->john, $account);

        $this->assertSame(count($operations), 4);
    }

    public function testDelete(): void
    {
        $account = $this->em->find('App:Account', 1);

        $operationsBeforeDelete = $this->get('test.app.operation')->getList($this->john, $account);
        $countOperationsBeforeDelete = count($operationsBeforeDelete);

        $operationsId = [1, 3];
        $this->get('test.app.operation')->delete($this->john, $operationsId);

        $operationsAfterDelete = $this->get('test.app.operation')->getList($this->john, $account);
        $countOperationsAfterDelete = count($operationsAfterDelete);

        $this->assertSame($countOperationsAfterDelete, $countOperationsBeforeDelete - 2);
    }

    public function testReconcile(): void
    {
        $dql = 'SELECT COUNT(o) ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.reconciled = true ';
        $query = $this->em->createQuery($dql);
        $operationsBeforeReconcile = $query->getSingleScalarResult();

        $operationsId = [1];
        $this->get('test.app.operation')->reconcile($this->john, $operationsId);

        $dql = 'SELECT COUNT(o) ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = 1 ';
        $dql .= 'AND o.reconciled = true ';
        $query = $this->em->createQuery($dql);
        $operationsAfterReconcile = $query->getSingleScalarResult();

        $this->assertSame($operationsAfterReconcile, $operationsBeforeReconcile + 1);
    }
}
