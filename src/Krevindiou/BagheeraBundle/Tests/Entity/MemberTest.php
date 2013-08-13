<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\Member;

class MemberTest extends TestCase
{
    public function testFindAll()
    {
        $members = $this->em->getRepository('Krevindiou\BagheeraBundle\Entity\Member')->findAll();

        $this->assertEquals(count($members), 3);
    }

    public function testJohn()
    {
        $john = $this->em->find('Krevindiou\BagheeraBundle\Entity\Member', 1);

        $this->assertEquals($john->getEmail(), 'john@example.net');
        $this->assertEquals(count($john->getBanks()), 4);
    }
}
