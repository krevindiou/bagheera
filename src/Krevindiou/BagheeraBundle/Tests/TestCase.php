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

namespace Krevindiou\BagheeraBundle\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase,
    Doctrine\ORM\Tools\SchemaTool,
    Doctrine\Common\DataFixtures\Loader,
    Doctrine\Common\DataFixtures\Purger\ORMPurger,
    Doctrine\Common\DataFixtures\Executor\ORMExecutor;

class TestCase extends WebTestCase
{
    protected $_em;
    protected $_kernel;

    public function get($service)
    {
        return $this->_kernel->getContainer()->get($service);
    }

    public function setUp()
    {
        $kernelNameClass = $this->getKernelClass();
        $kernel = new $kernelNameClass('test', true);
        $kernel->boot();

        $this->_kernel = $kernel;
        $this->_em = $this->get('doctrine.orm.entity_manager');

        $this->_createDatabase();
        $this->_importFixtures();
    }

    public function tearDown()
    {
        $this->_em->getUnitOfWork()->clear();
    }

    protected function _createDatabase()
    {
        $classes = $this->_em->getMetadataFactory()->getAllMetadata();
        $tool = new SchemaTool($this->_em);
        $tool->createSchema($classes);
    }

    protected function _importFixtures()
    {
        $loader = new Loader();
        $loader->loadFromDirectory(__DIR__ . '/../DataFixtures');

        $purger = new ORMPurger();
        $executor = new ORMExecutor($this->_em, $purger);
        $executor->execute($loader->getFixtures(), true);
    }
}
