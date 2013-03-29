<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase;
use Krevindiou\BagheeraBundle\Entity\User;

class UserTest extends TestCase
{
    public function testFindAll()
    {
        $users = $this->em->getRepository('Krevindiou\BagheeraBundle\Entity\User')->findAll();

        $this->assertEquals(count($users), 3);
    }

    public function testJohn()
    {
        $john = $this->em->find('Krevindiou\BagheeraBundle\Entity\User', 1);

        $this->assertEquals($john->getEmail(), 'john@example.net');
        $this->assertEquals(count($john->getBanks()), 4);
    }
}
