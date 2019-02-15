<?php

declare(strict_types=1);

namespace App\Tests\Service;

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

        $this->assertSame(count($list['credit']), 2);
        $this->assertSame(count($list['debit']), 3);
    }
}
