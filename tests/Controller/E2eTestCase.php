<?php

declare(strict_types=1);

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * @internal
 * @coversNothing
 */
abstract class E2eTestCase extends WebTestCase
{
    protected function setUp(): void
    {
        static::$kernel = static::createKernel(['environment' => 'test']);
        static::$kernel->boot();

        $conn = static::$kernel->getContainer()->get('doctrine.dbal.default_connection');

        $conn->exec('DROP SCHEMA IF EXISTS public CASCADE');

        $sql = file_get_contents(__DIR__.'/../../src/Resources/config/db/structure.sql');
        $conn->exec($sql);

        $sql = file_get_contents(__DIR__.'/../../src/Resources/config/db/data.sql');
        $conn->exec($sql);

        $sql = file_get_contents(__DIR__.'/../../src/Resources/config/db/fixtures.sql');
        $conn->exec($sql);
    }

    protected static function createAuthenticatedClient($username = 'john@example.net', $password = 'johnjohn')
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
