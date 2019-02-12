<?php

namespace App\Tests\Entity;

use App\Tests\TestCase;
use App\Entity\Member;

class MemberTest extends TestCase
{
    public function testFindAll()
    {
        $members = $this->em->getRepository('App:Member')->findAll();

        $this->assertEquals(count($members), 3);
    }

    public function testJohn()
    {
        $john = $this->em->find('App:Member', 1);

        $this->assertEquals($john->getEmail(), 'john@example.net');
        $this->assertEquals(count($john->getBanks()), 4);
    }
}
