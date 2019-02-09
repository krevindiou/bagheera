<?php

namespace App\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class TestCase extends WebTestCase
{
    protected $em;
    public static $kernel;
    public static $conn;

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

        self::$conn->exec('DROP SCHEMA IF EXISTS public CASCADE');

        $sql = file_get_contents(__DIR__.'/../../app/Resources/config/db/structure.sql');
        self::$conn->exec($sql);

        $sql = file_get_contents(__DIR__.'/../../app/Resources/config/db/fixtures.sql');
        self::$conn->exec($sql);
    }

    public static function createAuthenticatedClient($username = 'john@example.net', $password = 'johnjohn')
    {
        return static::createClient(
            [],
            [
                'PHP_AUTH_USER' => $username,
                'PHP_AUTH_PW' => $password,
            ]
        );
    }
}
