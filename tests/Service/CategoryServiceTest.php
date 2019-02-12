<?php

namespace App\Tests\Service;

use App\Tests\TestCase;

class CategoryServiceTest extends TestCase
{
    public function testGetList()
    {
        $list = $this->get('test.app.category')->getList();

        $this->assertEquals(count($list['credit']), 2);
        $this->assertEquals(count($list['debit']), 3);
    }
}
