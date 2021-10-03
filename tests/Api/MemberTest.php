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
        $response = $this->createClientWithCredentials()->request('GET', '/api/members/1');
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
        $response = $this->createClientWithCredentials()->request('GET', '/api/members/2');
        $this->assertResponseStatusCodeSame(403);
    }
}
