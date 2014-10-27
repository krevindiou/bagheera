<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Service;

use JMS\DiExtraBundle\Annotation as DI;

/**
 * AES-256 encryption (32 bytes long key)
 *
 * @DI\Service("app.crypt")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "crypt"})
 */
class CryptService
{
    /** @DI\Inject("%secret%") */
    public $secret;

    /**
     * Crypts data
     *
     * @param  mixed    $plainData  Data to crypt
     * @param  DateTime $expiration Expiration date
     * @return string
     */
    public function crypt($plainData, \DateTime $expiration = null)
    {
        $structure = [
            'data' => $plainData,
            'expiration' => (null === $expiration) ? : $expiration->format(\DateTime::ISO8601)
        ];

        $iv = mcrypt_create_iv(mcrypt_get_iv_size(MCRYPT_RIJNDAEL_128, MCRYPT_MODE_CBC), MCRYPT_RAND);

        $encryptedString = mcrypt_encrypt(
            MCRYPT_RIJNDAEL_128,
            $this->secret,
            json_encode($structure),
            MCRYPT_MODE_CBC,
            $iv
        );

        return base64_encode($iv . $encryptedString);
    }

    /**
     * Decrypts data
     *
     * @param  string $encryptedString Data to decrypt
     * @return mixed
     */
    public function decrypt($encryptedString)
    {
        if (false !== ($encryptedString = base64_decode($encryptedString))) {
            $encryptedString = trim(
                @mcrypt_decrypt(
                    MCRYPT_RIJNDAEL_128,
                    $this->secret,
                    substr($encryptedString, 16),
                    MCRYPT_MODE_CBC,
                    substr($encryptedString, 0, 16)
                )
            );

            if (null !== $encryptedString && null !== ($structure = json_decode($encryptedString, true))) {
                $now = new \DateTime();

                if (null === $structure['expiration'] || $structure['expiration'] <= $now->format(\DateTime::ISO8601)) {
                    return $structure['data'];
                }
            }
        }
    }
}
