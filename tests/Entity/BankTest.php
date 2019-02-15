<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class BankTest extends TestCase
{
    public function testFindAll(): void
    {
        $banks = $this->em->getRepository('App:Bank')->findAll();

        $this->assertSame(count($banks), 5);
    }

    public function testHsbc(): void
    {
        $hsbc = $this->em->find('App:Bank', 1);

        $this->assertSame($hsbc->getName(), 'HSBC');
        $this->assertSame($hsbc->getMember()->getEmail(), 'john@example.net');
        $this->assertSame(count($hsbc->getAccounts()), 4);
    }
}
