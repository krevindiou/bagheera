<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class AccountTest extends TestCase
{
    public function testFindAll(): void
    {
        $accounts = $this->em->getRepository('App:Account')->findAll();

        $this->assertSame(count($accounts), 8);
    }

    public function testCheckingAccount(): void
    {
        $checkingAccount1 = $this->em->find('App:Account', 1);

        $this->assertSame($checkingAccount1->getName(), 'John - HSBC - Checking account');
        $this->assertSame($checkingAccount1->getBank()->getName(), 'HSBC');
        $this->assertSame(count($checkingAccount1->getOperations()), 4);
        $this->assertSame(count($checkingAccount1->getSchedulers()), 2);
    }
}
