<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class MemberTest extends TestCase
{
    public function testFindAll(): void
    {
        $members = $this->em->getRepository('App:Member')->findAll();

        $this->assertSame(count($members), 3);
    }

    public function testJohn(): void
    {
        $john = $this->em->find('App:Member', 1);

        $this->assertSame($john->getEmail(), 'john@example.net');
        $this->assertSame(count($john->getBanks()), 4);
    }
}
