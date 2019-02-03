<?php

namespace AppBundle\Tests\Service;

use AppBundle\Tests\TestCase;

class CryptServiceTest extends TestCase
{
    public function testEncrypt()
    {
        $iv = hex2bin('c9cb372e627ce7f0c17742a71b76bc4a');

        $stub = $this
            ->getMockBuilder('AppBundle\Service\CryptService')
            ->setMethods(array('getRandomIv'))
            ->getMock();
        $stub->method('getRandomIv')
             ->willReturn($iv);

        $ciphertext = $stub->encrypt('test string', 'a1b45f788d830f1e2ae3a00c4d2965a8');

        $this->assertEquals('ycs3LmJ85/DBd0KnG3a8SjFZyvPk3TWQfY+/Q4qQ/OY=', $ciphertext);
    }

    public function testDecrypt()
    {
        $plaintext = $this->get('app.crypt')->decrypt(
            'ycs3LmJ85/DBd0KnG3a8SjFZyvPk3TWQfY+/Q4qQ/OY=',
            'a1b45f788d830f1e2ae3a00c4d2965a8'
        );

        $this->assertEquals('test string', $plaintext);
    }
}
