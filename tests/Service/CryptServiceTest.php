<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
final class CryptServiceTest extends TestCase
{
    public function testEncrypt(): void
    {
        $iv = hex2bin('c9cb372e627ce7f0c17742a71b76bc4a');

        $stub = $this
            ->getMockBuilder('App\Service\CryptService')
            ->setMethods(['getRandomIv'])
            ->getMock()
        ;
        $stub->method('getRandomIv')
            ->willReturn($iv)
        ;

        $ciphertext = $stub->encrypt('test string', 'a1b45f788d830f1e2ae3a00c4d2965a8');

        $this->assertSame('ycs3LmJ85/DBd0KnG3a8SjFZyvPk3TWQfY+/Q4qQ/OY=', $ciphertext);
    }

    public function testDecrypt(): void
    {
        $plaintext = $this->get('test.app.crypt')->decrypt(
            'ycs3LmJ85/DBd0KnG3a8SjFZyvPk3TWQfY+/Q4qQ/OY=',
            'a1b45f788d830f1e2ae3a00c4d2965a8'
        );

        $this->assertSame('test string', $plaintext);
    }
}
