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
    Krevindiou\BagheeraBundle\Entity\Transaction;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\TransactionServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class TransactionServiceTest extends TestCase
{
    public function testGetForm()
    {
        $transaction = new Transaction();

        $request = new Request();

        $form = $this->get('bagheera.transaction')->getForm($transaction, $request);

        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveEmpty()
    {
        $transaction = new Transaction();
        $transaction->setAccount(self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1));

        $request = new Request();
        $request->setMethod('POST');

        $form = $this->get('bagheera.transaction')->getForm($transaction, $request);

        $ok = $this->get('bagheera.transaction')->save($form);
        $this->assertFalse($ok);
    }

    public function testSaveAddOk()
    {
        $transaction = new Transaction();
        $transaction->setAccount(self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1));

        $post = array(
            'krevindiou_bagheerabundle_transactiontype' => array(
                'debitCredit' => 'debit',
                'thirdParty' => 'Test',
                'amount' => '5.00',
                'valueDate' => array('year' => 2011, 'month' => 10, 'day' => 11),
                'isReconciled' => '0',
                'notes' => 'Note #1',
                'transferAccount' => '',
                'category' => '',
                'paymentMethod' => '1',
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.transaction')->getForm($transaction, $request);

        $ok = $this->get('bagheera.transaction')->save($form);
        $this->assertTrue($ok);
    }

    public function testEditAndRemoveTransfer()
    {
        $dql = 'SELECT t ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'JOIN t.transferTransaction t2 ';
        $dql.= 'WHERE t.transactionId = :transactionId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('transactionId', 6);
        try {
            $transaction = $query->getSingleResult();
            $this->assertEquals($transaction->getTransferTransaction()->getTransactionId(), 1);
            $this->assertEquals($transaction->getTransferTransaction()->getAccount()->getAccountId(), 1);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferTransaction not found');
        }

        $valueDate = $transaction->getValueDate();

        $post = array(
            'krevindiou_bagheerabundle_transactiontype' => array(
                'debitCredit' => ($transaction->getDebit() > 0) ? 'debit' : 'credit',
                'thirdParty' => $transaction->getThirdParty(),
                'amount' => ($transaction->getDebit() > 0) ? $transaction->getDebit() : $transaction->getCredit(),
                'valueDate' => array('year' => $valueDate->format('Y'), 'month' => $valueDate->format('m'), 'day' => $valueDate->format('d')),
                'isReconciled' => $transaction->getIsReconciled(),
                'notes' => $transaction->getNotes(),
                'transferAccount' => null,
                'category' => $transaction->getCategory()->getCategoryId(),
                'paymentMethod' => 5,
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.transaction')->getForm($transaction, $request);

        $ok = $this->get('bagheera.transaction')->save($form);
        $this->assertTrue($ok);

        $dql = 'SELECT t ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'JOIN t.transferTransaction t2 ';
        $dql.= 'WHERE t.transactionId = :transactionId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('transactionId', 6);
        try {
            $transaction = $query->getSingleResult();
            $this->fail('transferTransaction found');
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->assertTrue(true);
        }
    }

    public function testEditAndChangeTransfer()
    {
        $dql = 'SELECT t ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'JOIN t.transferTransaction t2 ';
        $dql.= 'WHERE t.transactionId = :transactionId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('transactionId', 6);
        try {
            $transaction = $query->getSingleResult();
            $this->assertEquals($transaction->getTransferTransaction()->getTransactionId(), 1);
            $this->assertEquals($transaction->getTransferTransaction()->getAccount()->getAccountId(), 1);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferTransaction not found');
        }

        $valueDate = $transaction->getValueDate();

        $post = array(
            'krevindiou_bagheerabundle_transactiontype' => array(
                'debitCredit' => ($transaction->getDebit() > 0) ? 'debit' : 'credit',
                'thirdParty' => $transaction->getThirdParty(),
                'amount' => ($transaction->getDebit() > 0) ? $transaction->getDebit() : $transaction->getCredit(),
                'valueDate' => array('year' => $valueDate->format('Y'), 'month' => $valueDate->format('m'), 'day' => $valueDate->format('d')),
                'isReconciled' => $transaction->getIsReconciled(),
                'notes' => $transaction->getNotes(),
                'transferAccount' => 3,
                'category' => $transaction->getCategory()->getCategoryId(),
                'paymentMethod' => $transaction->getPaymentMethod()->getPaymentMethodId(),
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.transaction')->getForm($transaction, $request);

        $ok = $this->get('bagheera.transaction')->save($form);
        $this->assertTrue($ok);

        $dql = 'SELECT t ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'JOIN t.transferTransaction t2 ';
        $dql.= 'WHERE t.transactionId = :transactionId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('transactionId', 6);
        try {
            $transaction = $query->getSingleResult();
            $this->assertEquals($transaction->getTransferTransaction()->getTransactionId(), 1);
            $this->assertEquals($transaction->getTransferTransaction()->getAccount()->getAccountId(), 3);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferTransaction not found');
        }
    }

    public function testEditAndSetTransfer()
    {
        $dql = 'SELECT t ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'JOIN t.transferTransaction t2 ';
        $dql.= 'WHERE t.transactionId = :transactionId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('transactionId', 2);
        try {
            $transaction = $query->getSingleResult();
            $this->fail('transferTransaction found');
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->assertTrue(true);
        }

        $transaction = self::$_em->getRepository('KrevindiouBagheeraBundle:Transaction')->find(2);
        $valueDate = $transaction->getValueDate();

        $post = array(
            'krevindiou_bagheerabundle_transactiontype' => array(
                'debitCredit' => ($transaction->getDebit() > 0) ? 'debit' : 'credit',
                'thirdParty' => $transaction->getThirdParty(),
                'amount' => ($transaction->getDebit() > 0) ? $transaction->getDebit() : $transaction->getCredit(),
                'valueDate' => array('year' => $valueDate->format('Y'), 'month' => $valueDate->format('m'), 'day' => $valueDate->format('d')),
                'isReconciled' => $transaction->getIsReconciled(),
                'notes' => $transaction->getNotes(),
                'transferAccount' => 3,
                'category' => $transaction->getCategory()->getCategoryId(),
                'paymentMethod' => 4,
            ),
        );

        $request = new Request(array(), $post);
        $request->setMethod('POST');

        $form = $this->get('bagheera.transaction')->getForm($transaction, $request);

        $ok = $this->get('bagheera.transaction')->save($form);
        $this->assertTrue($ok);


        $dql = 'SELECT t ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'JOIN t.transferTransaction t2 ';
        $dql.= 'WHERE t.transactionId = :transactionId ';
        $query = self::$_em->createQuery($dql);
        $query->setParameter('transactionId', 2);
        try {
            $transaction = $query->getSingleResult();
            $this->assertEquals($transaction->getTransferTransaction()->getAccount()->getAccountId(), 3);
        } catch (\Doctrine\ORM\NoResultException $e) {
            $this->fail('transferTransaction not found');
        }
    }

    public function testGetTransactionsAccount1()
    {
        $account = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);
        $transactions = $this->get('bagheera.transaction')->getTransactions($account);

        $this->assertEquals(count($transactions), 4);
    }

    public function testDelete()
    {
        $account = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $transactionsBeforeDelete = $this->get('bagheera.transaction')->getTransactions($account);

        $transactionsId = array(1, 3);
        $this->get('bagheera.transaction')->delete($transactionsId);

        $transactionsAfterDelete = $this->get('bagheera.transaction')->getTransactions($account);

        $this->assertEquals(count($transactionsAfterDelete), count($transactionsBeforeDelete) - 2);
    }

    public function testReconcile()
    {
        $dql = 'SELECT COUNT(t) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'WHERE t.account = 1 ';
        $dql.= 'AND t.isReconciled = 1 ';
        $query = self::$_em->createQuery($dql);
        $transactionsBeforeReconcile = $query->getSingleScalarResult();

        $transactionsId = array(2);
        $this->get('bagheera.transaction')->reconcile($transactionsId);

        $dql = 'SELECT COUNT(t) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Transaction t ';
        $dql.= 'WHERE t.account = 1 ';
        $dql.= 'AND t.isReconciled = 1 ';
        $query = self::$_em->createQuery($dql);
        $transactionsAfterReconcile = $query->getSingleScalarResult();

        $this->assertEquals($transactionsAfterReconcile, $transactionsBeforeReconcile + 1);
    }
}
