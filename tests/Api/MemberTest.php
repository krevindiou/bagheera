<?php

declare(strict_types=1);

namespace App\Tests\Api;

/**
 * @internal
 * @coversNothing
 */
final class MemberTest extends AbstractTest
{
    public function testGetMember(): void
    {
        $this->createClientWithCredentials()->request('GET', '/api/members/1');
        $this->assertResponseIsSuccessful();
        $this->assertJsonContains([
            'data' => [
                'id' => '/api/members/1',
                'type' => 'Member',
                'attributes' => [
                    'memberId' => 1,
                    'email' => 'john@example.net',
                    'country' => 'US',
                ],
            ],
        ]);
    }

    public function testGetMemberDenied(): void
    {
        $this->createClientWithCredentials()->request('GET', '/api/members/2');
        $this->assertResponseStatusCodeSame(403);
    }

    public function testGetMemberNotFound(): void
    {
        $this->createClientWithCredentials()->request('GET', '/api/members/4');
        $this->assertResponseStatusCodeSame(404);
    }

    public function testCreateMember(): void
    {
        $response = $this->createAnonymousClient()->request('POST', '/api/members', [
            'json' => [
                'email' => 'roberto@example.net',
                'country' => 'IT',
                'plainPassword' => 'password',
            ],
        ]);

        $this->assertResponseIsSuccessful();
        static::assertSame('Member', $response->toArray()['data']['type']);
        static::assertSame('roberto@example.net', $response->toArray()['data']['attributes']['email']);
        static::assertSame('IT', $response->toArray()['data']['attributes']['country']);
    }
}
