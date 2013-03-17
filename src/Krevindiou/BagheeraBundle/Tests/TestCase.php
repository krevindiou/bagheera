<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Input\ArrayInput;

class TestCase extends WebTestCase
{
    protected $_em;
    protected $_kernel;
    protected $_application;

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

        $this->_application = new Application($kernel);
        $this->_application->setAutoExit(false);

        $this->_runConsole('doctrine:schema:drop', array('--force' => null));
        $this->_runConsole('doctrine:schema:create');
        $this->_runConsole('doctrine:fixtures:load', array('--append' => null));
    }

    public function tearDown()
    {
        $this->_em->getUnitOfWork()->clear();
    }

    protected function _runConsole($command, array $options = array())
    {
        $options['-e'] = 'test';
        $options['-q'] = null;
        $options['command'] = $command;

        return $this->_application->run(new ArrayInput($options));
    }
}
