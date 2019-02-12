<?php

namespace App\Tests\Entity;

use App\Tests\TestCase;
use App\Entity\Category;

class CategoryTest extends TestCase
{
    public function testFindAll()
    {
        $categories = $this->em->getRepository('App:Category')->findAll();

        $this->assertEquals(count($categories), 5);
    }

    public function testCat2()
    {
        $cat2 = $this->em->find('App:Category', 3);

        $this->assertEquals($cat2->getName(), 'Cat 2');
        $this->assertEquals($cat2->getParentCategory(), null);
        $this->assertEquals(count($cat2->getSubCategories()), 2);
    }

    public function testCat21()
    {
        $cat21 = $this->em->find('App:Category', 4);

        $this->assertEquals($cat21->getName(), 'Cat 2.1');
        $this->assertEquals($cat21->getParentCategory()->getName(), 'Cat 2');
        $this->assertEquals(count($cat21->getSubCategories()), 0);
    }
}
