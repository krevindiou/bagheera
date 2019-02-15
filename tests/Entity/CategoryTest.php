<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class CategoryTest extends TestCase
{
    public function testFindAll(): void
    {
        $categories = $this->em->getRepository('App:Category')->findAll();

        $this->assertSame(count($categories), 5);
    }

    public function testCat2(): void
    {
        $cat2 = $this->em->find('App:Category', 3);

        $this->assertSame($cat2->getName(), 'Cat 2');
        $this->assertSame($cat2->getParentCategory(), null);
        $this->assertSame(count($cat2->getSubCategories()), 2);
    }

    public function testCat21(): void
    {
        $cat21 = $this->em->find('App:Category', 4);

        $this->assertSame($cat21->getName(), 'Cat 2.1');
        $this->assertSame($cat21->getParentCategory()->getName(), 'Cat 2');
        $this->assertSame(count($cat21->getSubCategories()), 0);
    }
}
