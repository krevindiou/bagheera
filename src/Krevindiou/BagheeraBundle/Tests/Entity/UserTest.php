<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
