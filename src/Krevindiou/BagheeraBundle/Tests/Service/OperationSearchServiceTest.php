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
    Krevindiou\BagheeraBundle\Entity\OperationSearch;

/**
 * Krevindiou\BagheeraBundle\Tests\Service\OperationSearchServiceTest
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationSearchServiceTest extends TestCase
{
    public function setUp()
    {
        parent::setUp();

        $this->john = $this->_em->find('KrevindiouBagheeraBundle:User', 1);
        $this->jane = $this->_em->find('KrevindiouBagheeraBundle:User', 2);
    }

    public function testGetFormForForeignUser()
    {
        $operationSearch = $this->_em->find('KrevindiouBagheeraBundle:OperationSearch', 1);
        $form = $this->get('bagheera.operation_search')->getForm($this->jane, $operationSearch);
        $this->assertNull($form);
    }

    public function testGetFormForNewOperation()
    {
        $account = $this->_em->find('KrevindiouBagheeraBundle:Account', 1);
        $form = $this->get('bagheera.operation_search')->getForm($this->john, null, $account);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }

    public function testGetFormForExistingOperation()
    {
        $operationSearch = $this->_em->find('KrevindiouBagheeraBundle:OperationSearch', 1);
        $form = $this->get('bagheera.operation_search')->getForm($this->john, $operationSearch);
        $this->assertEquals(get_class($form), 'Symfony\Component\Form\Form');
    }
}
