<?php

namespace AppBundle\Service;

use JMS\DiExtraBundle\Annotation as DI;

/**
 * AES-256 encryption (32 bytes long key).
 *
 * @DI\Service("app.crypt")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "crypt"})
 */
class CryptService
{
    const METHOD = 'aes-256-cbc';

    /**
     * Returns a random initialization vector.
     *
     * @return string
     */
    protected function getRandomIv()
    {
        $ivLength = openssl_cipher_iv_length(self::METHOD);

        return openssl_random_pseudo_bytes($ivLength);
    }

    /**
     * Encrypts data.
     *
     * @param string $message Data to encrypt
     * @param string $key     Key used to encrypt
     *
     * @return string
     */
    public function encrypt($message, $key)
    {
        if (mb_strlen($key, '8bit') !== 32) {
            throw new \Exception('Key must be 256-bit long');
        }

        $iv = $this->getRandomIv();

        $ciphertext = openssl_encrypt(
            $message,
            self::METHOD,
            $key,
            OPENSSL_RAW_DATA,
            $iv
        );

        return base64_encode($iv.$ciphertext);
    }

    /**
     * Decrypts data.
     *
     * @param string $message Data to decrypt
     * @param string $key     Key used to decrypt
     *
     * @return string
     */
    public function decrypt($message, $key)
    {
        if (mb_strlen($key, '8bit') !== 32) {
            throw new \Exception('Key must be 256-bit long');
        }

        if (false !== ($message = base64_decode($message))) {
            $ivLength = openssl_cipher_iv_length(self::METHOD);
            $iv = mb_substr($message, 0, $ivLength, '8bit');
            $ciphertext = mb_substr($message, $ivLength, null, '8bit');

            return openssl_decrypt(
                $ciphertext,
                self::METHOD,
                $key,
                OPENSSL_RAW_DATA,
                $iv
            );
        }
    }
}
