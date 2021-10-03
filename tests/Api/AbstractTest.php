<?php

declare(strict_types=1);

namespace App\Tests\Api;

use ApiPlatform\Core\Bridge\Symfony\Bundle\Test\ApiTestCase;
use ApiPlatform\Core\Bridge\Symfony\Bundle\Test\Client;
use Hautelook\AliceBundle\PhpUnit\RefreshDatabaseTrait;

abstract class AbstractTest extends ApiTestCase
{
    use RefreshDatabaseTrait;

    private string $token = '';

    protected function createAnonymousClient(): Client
    {
        return self::createClient([], [
            'headers' => [
                'content-type' => 'application/json',
                'accept' => 'application/vnd.api+json',
            ],
        ]);
    }

    protected function createClientWithCredentials($token = null): Client
    {
        $token = $token ?: $this->getToken();

        return self::createClient([], [
            'headers' => [
                'content-type' => 'application/json',
                'accept' => 'application/vnd.api+json',
                'authorization' => 'Bearer '.$token,
            ],
        ]);
    }

    protected function getToken($json = []): string
    {
        if ($this->token) {
            return $this->token;
        }

        $response = $this->createAnonymousClient()->request('POST', '/api/login', [
            'json' => $json ?: [
                'email' => 'john@example.net',
                'password' => 'johnjohn',
            ],
        ]);

        $this->assertResponseIsSuccessful();
        $json = $response->toArray();
        static::assertArrayHasKey('token', $json);

        $this->token = $json['token'];

        return $json['token'];
    }
}
