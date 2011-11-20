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
    Symfony\Bundle\FrameworkBundle\Console\Application,
    Doctrine\ORM\Tools\SchemaTool,
    Doctrine\Common\DataFixtures\Loader,
    Doctrine\Common\DataFixtures\Purger\ORMPurger,
    Doctrine\Common\DataFixtures\Executor\ORMExecutor;

class TestCase extends WebTestCase
{
    static protected $_em;
    static protected $_kernel;

    public function __construct()
    {
        if (null === self::$_kernel) {
            $kernelNameClass = $this->getKernelClass();
            $kernel = new $kernelNameClass('test', true);
            $kernel->boot();

            self::$_kernel = $kernel;
            self::$_em = $this->get('doctrine.orm.entity_manager');

            $this->_createDatabase();
            $this->_importFixtures();
        }
    }

    public function get($service)
    {
        return self::$_kernel->getContainer()->get($service);
    }

    public function setUp()
    {
        self::$_em->getConnection()->beginTransaction();
    }

    public function tearDown()
    {
        self::$_em->getUnitOfWork()->clear();
        self::$_em->getConnection()->rollback();
    }

    protected function _createDatabase()
    {
        $classes = self::$_em->getMetadataFactory()->getAllMetadata();
        $tool = new SchemaTool(self::$_em);
        $tool->createSchema($classes);
    }

    protected function _importFixtures()
    {
        $loader = new Loader();
        $loader->loadFromDirectory(__DIR__ . '/../DataFixtures');

        $purger = new ORMPurger();
        $executor = new ORMExecutor(self::$_em, $purger);
        $executor->execute($loader->getFixtures(), true);
    }
}
