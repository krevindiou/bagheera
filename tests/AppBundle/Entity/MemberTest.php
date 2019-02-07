<?php

namespace Tests\AppBundle\Entity;

use Tests\AppBundle\TestCase;
use AppBundle\Entity\Member;

class MemberTest extends TestCase
{
    public function testFindAll()
    {
        $members = $this->em->getRepository('AppBundle:Member')->findAll();

        $this->assertEquals(count($members), 3);
    }

    public function testJohn()
    {
        $john = $this->em->find('AppBundle:Member', 1);

        $this->assertEquals($john->getEmail(), 'john@example.net');
        $this->assertEquals(count($john->getBanks()), 4);
    }
}
