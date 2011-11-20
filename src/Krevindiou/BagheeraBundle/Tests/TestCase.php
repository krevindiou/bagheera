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
    Symfony\Component\Console\Input\ArrayInput,
    Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;

class TestCase extends WebTestCase
{
    static protected $_em;
    static protected $_application;
    static protected $_container;

    public function __construct()
    {
        if (null === self::$_em) {
            $kernelNameClass = $this->getKernelClass();
            $kernel = new $kernelNameClass('test', true);
            $kernel->boot();

            self::$_container = $kernel->getContainer();

            self::$_em = self::$_container->get('doctrine.orm.entity_manager');

            self::$_application = new Application($kernel);
            self::$_application->setAutoExit(false);

            $this->_runConsole('doctrine:schema:create');
            $this->_runConsole('doctrine:fixtures:load', array('--append' => ''));
        }
    }

    protected function _runConsole($command, array $options = array())
    {
        $options = array_merge($options, array('command' => $command));
        return self::$_application->run(new ArrayInput($options));
    }

    public function get($service)
    {
        return self::$_container->get($service);
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
}
