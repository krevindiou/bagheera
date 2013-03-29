<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Service;

use Krevindiou\BagheeraBundle\Tests\TestCase;

class CategoryServiceTest extends TestCase
{
    public function testGetList()
    {
        $list = $this->get('bagheera.category')->getList();

        $this->assertEquals(count($list['credit']), 2);
        $this->assertEquals(count($list['debit']), 3);
    }
}
