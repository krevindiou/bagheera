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

    public function get($service)
    {
        return static::$kernel->getContainer()->get($service);
    }

    public function setUp()
    {
        static::$kernel = static::createKernel(['environment' => 'test']);
        static::$kernel->boot();

        $this->em = $this->get('doctrine.orm.entity_manager');
        $this->em->getConnection()->beginTransaction();

        $this->em->getConnection()->exec('DROP SCHEMA public CASCADE');

        $sql = file_get_contents(__DIR__ . '/../../../app/Resources/config/db/structure.sql');
        $this->em->getConnection()->exec($sql);

        $sql = file_get_contents(__DIR__ . '/../../../app/Resources/config/db/fixtures.sql');
        $this->em->getConnection()->exec($sql);
    }

    public function tearDown()
    {
        $this->em->getConnection()->rollback();
        $this->em->getConnection()->close();
        parent::tearDown();
    }

    public function initClient($username = 'john@example.net', $password = 'johnjohn')
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
