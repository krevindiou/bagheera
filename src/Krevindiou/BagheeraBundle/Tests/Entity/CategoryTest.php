<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\Category;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\Category
 *
 */
class CategoryTest extends TestCase
{
    public function testFindAll()
    {
        $categories = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\Category')->findAll();

        $this->assertEquals(count($categories), 5);
    }

    public function testCat2()
    {
        $cat2 = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Category', 3);

        $this->assertEquals($cat2->getName(), 'Cat 2');
        $this->assertEquals($cat2->getParentCategory(), null);
        $this->assertEquals(count($cat2->getSubCategories()), 2);
    }

    public function testCat21()
    {
        $cat21 = $this->_em->find('Krevindiou\BagheeraBundle\Entity\Category', 4);

        $this->assertEquals($cat21->getName(), 'Cat 2.1');
        $this->assertEquals($cat21->getParentCategory()->getName(), 'Cat 2');
        $this->assertEquals(count($cat21->getSubCategories()), 0);
    }
}
