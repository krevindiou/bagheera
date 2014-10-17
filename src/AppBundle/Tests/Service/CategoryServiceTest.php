<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Tests\Service;

use AppBundle\Tests\TestCase;

class CategoryServiceTest extends TestCase
{
    public function testGetList()
    {
        $list = $this->get('app.category')->getList();

        $this->assertEquals(count($list['credit']), 2);
        $this->assertEquals(count($list['debit']), 3);
    }
}
