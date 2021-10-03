<?php

declare(strict_types=1);

namespace App\Tests\Api;

/**
 * @internal
 * @coversNothing
 */
final class AuthenticationTest extends AbstractTest
{
    public function testLogin(): void
    {
        // Not authorized
        $this->createAnonymousClient()->request('GET', '/api');
        $this->assertResponseStatusCodeSame(401);

        // Authorized
        $this->createClientWithCredentials()->request('GET', '/api');
        $this->assertResponseIsSuccessful();
    }
}
