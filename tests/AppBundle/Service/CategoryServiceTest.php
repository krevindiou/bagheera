<?php

namespace Tests\AppBundle\Service;

use Tests\AppBundle\TestCase;

class CategoryServiceTest extends TestCase
{
    public function testGetList()
    {
        $list = $this->get('app.category')->getList();

        $this->assertEquals(count($list['credit']), 2);
        $this->assertEquals(count($list['debit']), 3);
    }
}
