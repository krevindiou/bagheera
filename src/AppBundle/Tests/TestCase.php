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
    static public $kernel;
    static public $conn;

    public function get($service)
    {
        return self::$kernel->getContainer()->get($service);
    }

    public function setUp()
    {
        if (!self::$kernel) {
            self::$kernel = self::createKernel(['environment' => 'test']);
            self::$kernel->boot();

            self::$conn = self::$kernel->getContainer()->get('doctrine.dbal.default_connection');
        } else {
            self::$kernel->boot();
            self::$kernel->getContainer()->set('doctrine.dbal.default_connection', self::$conn);
        }

        $this->em = $this->get('doctrine.orm.entity_manager');

        self::$conn->exec('DROP SCHEMA public CASCADE');

        $sql = file_get_contents(__DIR__ . '/../../../app/Resources/config/db/structure.sql');
        self::$conn->exec($sql);

        $sql = file_get_contents(__DIR__ . '/../../../app/Resources/config/db/fixtures.sql');
        self::$conn->exec($sql);
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
    }
}
