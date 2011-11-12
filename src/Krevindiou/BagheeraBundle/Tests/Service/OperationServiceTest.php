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

use Symfony\Component\HttpFoundation\Request,
    Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Operation;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\OperationServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationServiceTest extends TestCase
{
    public function testGetForm()
    {
        $operation = new Operation();

        $form = $this->get('bagheera.operation')->getForm($operation);

        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveEmpty()
    {
        $operation = new Operation();
        $operation->setAccount(self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1));

        $form = $this->get('bagheera.operation')->getForm($operation);

        $ok = $this->get('bagheera.operation')->save($form);
        $this->assertFalse($ok);
    }

    public function testSaveAddOk()
    {
        $operation = new Operation();
        $operation->setAccount(self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1));

        $values = array(
            'debitCredit' => 'debit',
            'thirdParty' => 'Test',
            'amount' => '5.00',
            'valueDate' => array('year' => 2011, 'month' => 10, 'day' => 11),
            'isReconciled' => '0',
            'notes' => 'Note #1',
            'transferAccount' => '',
            'category' => '',
            'paymentMethod' => '1',
        );

        $form = $this->get('bagheera.operation')->getForm($operation, $values);

        $ok = $this->get('bagheera.operation')->save($form);
        $this->assertTrue($ok);
    }

    public function testEditAndRemoveTransfer()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'JOIN o.transferOperation o2 ';
        $dql.= 'WHERE o.operationId = :operationId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('operationId', 6);
        try {
            $operation = $query->getSingleResult();
            $this->assertEquals($operation->getTransferOperation()->getOperationId(), 1);
            $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 1);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferOperation not found');
        }

        $valueDate = $operation->getValueDate();

        $values = array(
            'debitCredit' => ($operation->getDebit() > 0) ? 'debit' : 'credit',
            'thirdParty' => $operation->getThirdParty(),
            'amount' => ($operation->getDebit() > 0) ? $operation->getDebit() : $operation->getCredit(),
            'valueDate' => array('year' => $valueDate->format('Y'), 'month' => $valueDate->format('m'), 'day' => $valueDate->format('d')),
            'isReconciled' => $operation->getIsReconciled(),
            'notes' => $operation->getNotes(),
            'transferAccount' => null,
            'category' => $operation->getCategory()->getCategoryId(),
            'paymentMethod' => 5,
        );

        $form = $this->get('bagheera.operation')->getForm($operation, $values);

        $ok = $this->get('bagheera.operation')->save($form);
        $this->assertTrue($ok);

        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'JOIN o.transferOperation o2 ';
        $dql.= 'WHERE o.operationId = :operationId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('operationId', 6);
        try {
            $operation = $query->getSingleResult();
            $this->fail('transferOperation found');
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->assertTrue(true);
        }
    }

    public function testEditAndChangeTransfer()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'JOIN o.transferOperation o2 ';
        $dql.= 'WHERE o.operationId = :operationId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('operationId', 6);
        try {
            $operation = $query->getSingleResult();
            $this->assertEquals($operation->getTransferOperation()->getOperationId(), 1);
            $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 1);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferOperation not found');
        }

        $valueDate = $operation->getValueDate();

        $values = array(
            'debitCredit' => ($operation->getDebit() > 0) ? 'debit' : 'credit',
            'thirdParty' => $operation->getThirdParty(),
            'amount' => ($operation->getDebit() > 0) ? $operation->getDebit() : $operation->getCredit(),
            'valueDate' => array('year' => $valueDate->format('Y'), 'month' => $valueDate->format('m'), 'day' => $valueDate->format('d')),
            'isReconciled' => $operation->getIsReconciled(),
            'notes' => $operation->getNotes(),
            'transferAccount' => 3,
            'category' => $operation->getCategory()->getCategoryId(),
            'paymentMethod' => $operation->getPaymentMethod()->getPaymentMethodId(),
        );

        $form = $this->get('bagheera.operation')->getForm($operation, $values);

        $ok = $this->get('bagheera.operation')->save($form);
        $this->assertTrue($ok);

        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'JOIN o.transferOperation o2 ';
        $dql.= 'WHERE o.operationId = :operationId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('operationId', 6);
        try {
            $operation = $query->getSingleResult();
            $this->assertEquals($operation->getTransferOperation()->getOperationId(), 1);
            $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferOperation not found');
        }
    }

    public function testEditAndSetTransfer()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'JOIN o.transferOperation o2 ';
        $dql.= 'WHERE o.operationId = :operationId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('operationId', 2);
        try{
            $operation = $query->getSingleResult();
            $this->fail('transferOperation found');
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->assertTrue(true);
        }

        $operation = self::$_em->getRepository('KrevindiouBagheeraBundle:Operation')->find(2);
        $valueDate = $operation->getValueDate();

        $values = array(
            'debitCredit' => ($operation->getDebit() > 0) ? 'debit' : 'credit',
            'thirdParty' => $operation->getThirdParty(),
            'amount' => ($operation->getDebit() > 0) ? $operation->getDebit() : $operation->getCredit(),
            'valueDate' => array('year' => $valueDate->format('Y'), 'month' => $valueDate->format('m'), 'day' => $valueDate->format('d')),
            'isReconciled' => $operation->getIsReconciled(),
            'notes' => $operation->getNotes(),
            'transferAccount' => 3,
            'category' => $operation->getCategory()->getCategoryId(),
            'paymentMethod' => 4,
        );

        $form = $this->get('bagheera.operation')->getForm($operation, $values);

        $ok = $this->get('bagheera.operation')->save($form);
        $this->assertTrue($ok);


        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'JOIN o.transferOperation o2 ';
        $dql.= 'WHERE o.operationId = :operationId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('operationId', 2);
        try {
            $operation = $query->getSingleResult();
            $this->assertEquals($operation->getTransferOperation()->getAccount()->getAccountId(), 3);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferOperation not found');
        }
    }

    public function testGetOperationsAccount1()
    {
        $account = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);
        $operations = $this->get('bagheera.operation')->getOperations($account);

        $this->assertEquals(count($operations), 4);
    }

    public function testDelete()
    {
        $account = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $operationsBeforeDelete = $this->get('bagheera.operation')->getOperations($account);

        $operationsId = array(1, 3);
        $this->get('bagheera.operation')->delete($operationsId);

        $operationsAfterDelete = $this->get('bagheera.operation')->getOperations($account);

        $this->assertEquals(count($operationsAfterDelete), count($operationsBeforeDelete) - 2);
    }

    public function testReconcile()
    {
        $dql = 'SELECT COUNT(o) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.isReconciled = 1 ';
        $query = self::$_em->createQuery($dql);
        $operationsBeforeReconcile = $query->getSingleScalarResult();

        $operationsId = array(2);
        $this->get('bagheera.operation')->reconcile($operationsId);

        $dql = 'SELECT COUNT(o) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.isReconciled = 1 ';
        $query = self::$_em->createQuery($dql);
        $operationsAfterReconcile = $query->getSingleScalarResult();

        $this->assertEquals($operationsAfterReconcile, $operationsBeforeReconcile + 1);
    }
}
