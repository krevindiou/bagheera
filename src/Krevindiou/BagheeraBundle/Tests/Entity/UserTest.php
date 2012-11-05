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
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserTest extends TestCase
{
    public function testFindAll()
    {
        $users = $this->_em->getRepository('Krevindiou\BagheeraBundle\Entity\User')->findAll();

        $this->assertEquals(count($users), 2);
    }

    public function testJohn()
    {
        $john = $this->_em->find('Krevindiou\BagheeraBundle\Entity\User', 1);

        $this->assertEquals($john->getEmail(), 'john@example.net');
        $this->assertEquals(count($john->getBanks()), 2);
    }

    public function testJane()
    {
        $jane = $this->_em->find('Krevindiou\BagheeraBundle\Entity\User', 2);

        $this->assertEquals($jane->getEmail(), 'jane@example.net');
        $this->assertEquals(count($jane->getBanks()), 1);
    }
}
