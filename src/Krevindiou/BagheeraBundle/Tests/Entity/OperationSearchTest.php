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

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\Operation;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Operation
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationSearchTest extends TestCase
{
    public function testFindAll()
    {
        $operationSearches = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\OperationSearch')->findAll();

        $this->assertEquals(count($operationSearches), 3);
    }

    public function testOperationSearch()
    {
        $operationSearch = $this->_em->find('Krevindiou\BagheeraBundle\Entity\OperationSearch', 1);
        $this->assertEquals($operationSearch->getThirdParty(), 'Third party 1');

        $operationSearch = $this->_em->find('Krevindiou\BagheeraBundle\Entity\OperationSearch', 2);
        $this->assertEquals(count($operationSearch->getCategories()), 1);
        $this->assertEquals($operationSearch->getCategories()->first()->getName(), 'Cat 2.1');

        $operationSearch = $this->_em->find('Krevindiou\BagheeraBundle\Entity\OperationSearch', 3);
        $this->assertEquals(count($operationSearch->getPaymentMethods()), 1);
        $this->assertEquals($operationSearch->getPaymentMethods()->first()->getName(), 'credit_card');
    }
}
