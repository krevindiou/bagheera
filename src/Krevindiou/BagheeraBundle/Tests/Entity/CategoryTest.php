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
    Krevindiou\BagheeraBundle\Entity\Category;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Category
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class CategoryTest extends TestCase
{
    public function testFindAll()
    {
        $categories = self::$_em->getRepository('Krevindiou\BagheeraBundle\Entity\Category')->findAll();

        $this->assertEquals(count($categories), 5);
    }

    public function testCat1()
    {
        $cat1 = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Category', 1);

        $this->assertEquals($cat1->getName(), 'Cat 1');
        $this->assertEquals($cat1->getParentCategory(), null);
        $this->assertEquals(count($cat1->getSubCategories()), 1);
    }

    public function testCat11()
    {
        $cat11 = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Category', 2);

        $this->assertEquals($cat11->getName(), 'Cat 1.1');
        $this->assertEquals($cat11->getParentCategory()->getName(), 'Cat 1');
        $this->assertEquals(count($cat11->getSubCategories()), 0);
    }

    public function testCat2()
    {
        $cat2 = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Category', 3);

        $this->assertEquals($cat2->getName(), 'Cat 2');
        $this->assertEquals($cat2->getParentCategory(), null);
        $this->assertEquals(count($cat2->getSubCategories()), 2);
    }

    public function testCat21()
    {
        $cat21 = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Category', 4);

        $this->assertEquals($cat21->getName(), 'Cat 2.1');
        $this->assertEquals($cat21->getParentCategory()->getName(), 'Cat 2');
        $this->assertEquals(count($cat21->getSubCategories()), 0);
    }

    public function testCat22()
    {
        $cat22 = self::$_em->find('Krevindiou\BagheeraBundle\Entity\Category', 5);

        $this->assertEquals($cat22->getName(), 'Cat 2.2');
        $this->assertEquals($cat22->getParentCategory()->getName(), 'Cat 2');
        $this->assertEquals(count($cat22->getSubCategories()), 0);
    }
}
