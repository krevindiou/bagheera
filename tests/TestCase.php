<?php

declare(strict_types=1);

namespace App\Tests;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * @internal
 * @coversNothing
 */
abstract class TestCase extends WebTestCase
{
    public static $kernel;
    public static $conn;
    protected $em;

    protected function setUp(): void
    {
        if (null === self::$kernel) {
            self::$kernel = self::createKernel(['environment' => 'test']);
            self::$kernel->boot();

            self::$conn = self::$kernel->getContainer()->get('doctrine.dbal.default_connection');
        } else {
            self::$kernel->boot();
            self::$kernel->getContainer()->set('doctrine.dbal.default_connection', self::$conn);
        }

        $this->em = $this->get('doctrine.orm.entity_manager');

        self::$conn->exec('DROP SCHEMA IF EXISTS public CASCADE');

        $sql = file_get_contents(__DIR__.'/../src/Resources/config/db/structure.sql');
        self::$conn->exec($sql);

        $sql = file_get_contents(__DIR__.'/../src/Resources/config/db/data.sql');
        self::$conn->exec($sql);

        $sql = file_get_contents(__DIR__.'/../src/Resources/config/db/fixtures.sql');
        self::$conn->exec($sql);
    }

    public function get($service)
    {
        return self::$kernel->getContainer()->get($service);
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
