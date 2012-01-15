<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Operation;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\OperationServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->_em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetFormForForeignUser()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 1);
        $form = $this->get('bagheera.operation')->getForm($this->jane, $operation);
        $this->assertNull($form);
    }

    public function testGetFormForNewOperation()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $form = $this->get('bagheera.operation')->getForm($this->john, null, $account);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingOperation()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 1);
        $form = $this->get('bagheera.operation')->getForm($this->john, $operation);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveNewOperationWithNoData()
    {
        $operation = new Operation();
        $this->assertFalse($this->get('bagheera.operation')->save($this->john, $operation));
    }

    public function testSaveNewOperationWithForeignAccount()
    {
        $operation = new Operation();
        $operation->setAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 4));
        $operation->setThirdParty('Test');
        $operation->setValueDate(new \DateTime());
        $operation->setPaymentMethod($this->_em->find('KrevindiouBagheeraBundle:PaymentMethod', 1));
        $this->assertFalse($this->get('bagheera.operation')->save($this->john, $operation));
    }

    public function testSaveNewOperation()
    {
        $operation = new Operation();
        $operation->setAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 1));
        $operation->setThirdParty('Test');
        $operation->setValueDate(new \DateTime());
        $operation->setPaymentMethod($this->_em->find('KrevindiouBagheeraBundle:PaymentMethod', 1));
        $this->assertTrue($this->get('bagheera.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithBadData()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 1);
        $operation->setThirdParty('');
        $this->assertFalse($this->get('bagheera.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithForeignAccount()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 1);
        $operation->setAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 4));
        $this->assertFalse($this->get('bagheera.operation')->save($this->john, $operation));
    }

    public function testSaveExistingOperationWithForeignUser()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 1);
        $this->assertFalse($this->get('bagheera.operation')->save($this->jane, $operation));
    }

    public function testSaveExistingOperation()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 1);
        $this->assertTrue($this->get('bagheera.operation')->save($this->john, $operation));
    }

    public function testEditAndRemoveTransfer()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 6);
        $operation->setTransferAccount(null);
        $operation->setPaymentMethod($this->_em->find('KrevindiouBagheeraBundle:PaymentMethod', 5));

        $this->assertTrue($this->get('bagheera.operation')->save($this->john, $operation));

        $this->_em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 6);
        $this->assertNull($operation->getTransferOperation());
        $this->assertNull($operation->getTransferAccount());
    }

    public function testEditAndChangeTransfer()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 6);
        $operation->setTransferAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 3));

        $this->assertTrue($this->get('bagheera.operation')->save($this->john, $operation));

        $this->_em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 6);
        $this->assertEquals($operation->getTransferOperation()->getOperationId(), 1);
        $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        $this->assertEquals($operation->getTransferAccount()->getAccountId(), 3);
    }

    public function testEditAndSetTransfer()
    {
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 2);
        $operation->setTransferAccount($this->_em->find('KrevindiouBagheeraBundle:Account', 3));
        $operation->setPaymentMethod($this->_em->find('KrevindiouBagheeraBundle:PaymentMethod', 4));

        $this->assertTrue($this->get('bagheera.operation')->save($this->john, $operation));

        $this->_em->getUnitOfWork()->removeFromIdentityMap($operation);
        $operation = $this->_em->find('KrevindiouBagheeraBundle:Operation', 2);
        $this->assertEquals($operation->getTransferOperation()->getOperationId(), 11);
        $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        $this->assertEquals($operation->getTransferAccount()->getAccountId(), 3);
    }

    public function testGetOperations()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $operations = $this->get('bagheera.operation')->getList($this->john, $account);

        $this->assertEquals(count($operations), 4);
    }

    public function testDelete()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);

        $operationsBeforeDelete = $this->get('bagheera.operation')->getList($this->john, $account);
        $countOperationsBeforeDelete = count($operationsBeforeDelete);

        $operationsId = array(1, 3);
        $this->get('bagheera.operation')->delete($this->john, $operationsId);

        $operationsAfterDelete = $this->get('bagheera.operation')->getList($this->john, $account);
        $countOperationsAfterDelete = count($operationsAfterDelete);

        $this->assertEquals($countOperationsAfterDelete, $countOperationsBeforeDelete - 2);
    }

    public function testReconcile()
    {
        $dql = 'SELECT COUNT(o) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.isReconciled = 1 ';
        $query = $this->_em->createQuery($dql);
        $operationsBeforeReconcile = $query->getSingleScalarResult();

        $operationsId = array(2);
        $this->get('bagheera.operation')->reconcile($this->john, $operationsId);

        $dql = 'SELECT COUNT(o) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.isReconciled = 1 ';
        $query = $this->_em->createQuery($dql);
        $operationsAfterReconcile = $query->getSingleScalarResult();

        $this->assertEquals($operationsAfterReconcile, $operationsBeforeReconcile + 1);
    }
}
