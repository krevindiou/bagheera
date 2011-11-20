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
    Krevindiou\BagheeraBundle\Entity\Scheduler;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\SchedulerServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerServiceTest extends TestCase
{
    public function testGetForm()
    {
        $scheduler = new Scheduler();

        $form = $this->get('bagheera.scheduler')->getForm($scheduler);

        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testSaveEmpty()
    {
        $scheduler = new Scheduler();
        $scheduler->setAccount(self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1));

        $values = array(
            'debitCredit' => '',
            'thirdParty' => '',
            'amount' => '',
            'valueDate' => array(
                'year' => '',
                'month' => '',
                'day' => ''
            ),
            'limitDate' => array(
                'year' => '',
                'month' => '',
                'day' => ''
            ),
            'isReconciled' => '',
            'isActive' => '',
            'frequencyUnit' => '',
            'frequencyValue' => '',
            'notes' => '',
            'transferAccount' => '',
            'category' => '',
            'paymentMethod' => '',
        );

        $form = $this->get('bagheera.scheduler')->getForm($scheduler, $values);
        $this->assertFalse($form->isValid());
    }

    public function testSaveAddOk()
    {
        $scheduler = new Scheduler();
        $scheduler->setAccount(self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1));

        $values = array(
            'debitCredit' => 'debit',
            'thirdParty' => 'Test',
            'amount' => '5.00',
            'valueDate' => array(
                'year' => '2011',
                'month' => '10',
                'day' => '11'
            ),
            'limitDate' => array(
                'year' => '',
                'month' => '',
                'day' => ''
            ),
            'isReconciled' => '0',
            'isActive' => '1',
            'frequencyUnit' => 'month',
            'frequencyValue' => '1',
            'notes' => 'Note #1',
            'transferAccount' => '',
            'category' => '',
            'paymentMethod' => '1',
        );

        $form = $this->get('bagheera.scheduler')->getForm($scheduler, $values);

        $isValid = $form->isValid();
        $this->assertTrue($isValid);

        if ($isValid) {
            $ok = $this->get('bagheera.scheduler')->save(
                $form->getData(),
                $form->get('debitCredit')->getData(),
                $form->get('amount')->getData()
            );
            $this->assertTrue($ok);
        }
    }

    public function testGetSchedulersAccount1()
    {
        $account = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);
        $schedulers = $this->get('bagheera.scheduler')->getSchedulers($account);

        $this->assertEquals(count($schedulers), 2);
    }

    public function testDelete()
    {
        $account = self::$_em->getRepository('KrevindiouBagheeraBundle:Account')->find(1);

        $schedulersBeforeDelete = $this->get('bagheera.scheduler')->getSchedulers($account);

        $schedulersId = array(1);
        $this->get('bagheera.scheduler')->delete($schedulersId);

        $schedulersAfterDelete = $this->get('bagheera.scheduler')->getSchedulers($account);

        $this->assertEquals(count($schedulersAfterDelete), count($schedulersBeforeDelete) - 1);
    }

    public function testRunSchedulers()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 1 ';
        $query = self::$_em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $this->get('bagheera.scheduler')->runSchedulers($user, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 1 ';
        $query = self::$_em->createQuery($dql);
        $operationsAfter = $query->getResult();


        $operationsBeforeDate = array();
        foreach ($operationsBefore as $operationBefore) {
            $operationsBeforeDate[] = $operationBefore->getValueDate()->format('Y-m-d');
        }

        $operationsAfterDate = array();
        foreach ($operationsAfter as $operationAfter) {
            $operationsAfterDate[] = $operationAfter->getValueDate()->format('Y-m-d');
        }

        $newOperations = array_diff($operationsAfterDate, $operationsBeforeDate);
        $this->assertEquals(count($newOperations), 5);
        $this->assertEquals($newOperations[1], '2011-09-15');
        $this->assertEquals($newOperations[2], '2011-09-29');
        $this->assertEquals($newOperations[3], '2011-10-13');
        $this->assertEquals($newOperations[4], '2011-10-27');
        $this->assertEquals($newOperations[5], '2011-11-10');
    }

    public function testRunSchedulersWithFutureValueDate()
    {
        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 2 ';
        $query = self::$_em->createQuery($dql);
        $operationsBefore = $query->getResult();

        $user = self::$_em->getRepository('KrevindiouBagheeraBundle:User')->find(1);
        $this->get('bagheera.scheduler')->runSchedulers($user, new \DateTime('2011-11-12'));

        $dql = 'SELECT o ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = 1 ';
        $dql.= 'AND o.scheduler = 2 ';
        $query = self::$_em->createQuery($dql);
        $operationsAfter = $query->getResult();

        $this->assertEquals(count($operationsBefore), count($operationsAfter));
    }
}
