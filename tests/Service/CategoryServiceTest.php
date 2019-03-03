<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\Category;
use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class CategoryServiceTest extends TestCase
{
    public function testGetList(): void
    {
        $list = $this->get('test.app.category')->getList();

        $this->assertSame(count(array_filter($list->toArray(), function (Category $category) { return 'credit' === $category->getType(); })), 2);
        $this->assertSame(count(array_filter($list->toArray(), function (Category $category) { return 'debit' === $category->getType(); })), 3);
    }
}
