<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests\Entity;

use Krevindiou\BagheeraBundle\Tests\TestCase,
    Krevindiou\BagheeraBundle\Entity\User;

/**
 * Krevindiou\BagheeraBundle\Tests\Entity\User
 *
 */
class UserTest extends TestCase
{
    public function testFindAll()
    {
        $users = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\User')->findAll();

        $this->assertEquals(count($users), 3);
    }

    public function testJohn()
    {
        $john = $this->_em->find('Krevindiou\BagheeraBundle\Entity\User', 1);

        $this->assertEquals($john->getEmail(), 'john@example.net');
        $this->assertEquals(count($john->getBanks()), 4);
    }
}
