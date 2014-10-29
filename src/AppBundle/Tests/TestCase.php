<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Input\ArrayInput;

class TestCase extends WebTestCase
{
    protected $em;
    protected $application;

    public function get($service)
    {
        return static::$kernel->getContainer()->get($service);
    }

    public function setUp()
    {
        static::$kernel = static::createKernel(['environment' => 'test']);
        static::$kernel->boot();

        $this->em = $this->get('doctrine.orm.entity_manager');

        $this->application = new Application(static::$kernel);
        $this->application->setAutoExit(false);

        $this->runConsole('doctrine:schema:drop', ['--force' => null]);
        $this->runConsole('doctrine:schema:create');
        $this->runConsole('doctrine:schema:update', ['--force' => null]); // Still some SQL to execute
        $this->runConsole('doctrine:fixtures:load', ['--append' => null]);
    }

    public function tearDown()
    {
        $this->em->getUnitOfWork()->clear();
        $this->em->getConnection()->close();
        parent::tearDown();
    }

    protected function runConsole($command, array $options = [])
    {
        $options['-e'] = 'test';
        $options['-q'] = null;
        $options['command'] = $command;

        return $this->application->run(new ArrayInput($options));
    }

    public function initClient($username = 'john@example.net', $password = 'john')
    {
        $this->client = static::createClient(
            [],
            [
                'PHP_AUTH_USER' => $username,
                'PHP_AUTH_PW' => $password,
            ]
        );

        $this->get('router')->getContext()->setHost(gethostname());
    }
}
