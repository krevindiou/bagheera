<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use JMS\DiExtraBundle\Annotation as DI;

/**
 * AES-256 encryption (32 bytes long key)
 *
 * @DI\Service("bagheera.crypt")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "crypt"})
 */
class CryptService
{
    /** @DI\Inject("%secret%") */
    public $secret;

    /**
     * Crypts array
     *
     * @param  array    $data       Data to crypt
     * @param  DateTime $expiration Expiration date
     * @return string
     */
    public function crypt(array $data, \DateTime $expiration = null)
    {
        if (null !== $expiration) {
            $data = array_merge(
                $data,
                array('_expiration' => $expiration->format(\DateTime::ISO8601))
            );
        }

        $iv = mcrypt_create_iv(mcrypt_get_iv_size(MCRYPT_RIJNDAEL_128, MCRYPT_MODE_CBC), MCRYPT_RAND);

        $encryptedStr = mcrypt_encrypt(
            MCRYPT_RIJNDAEL_128,
            $this->secret,
            json_encode($data),
            MCRYPT_MODE_CBC,
            $iv
        );

        return base64_encode($iv . $encryptedStr);
    }

    /**
     * Decrypts string
     *
     * @param  string $str String to decrypt
     * @return array
     */
    public function decrypt($str)
    {
        if (false !== ($str = base64_decode($str))) {
            $str = trim(
                mcrypt_decrypt(
                    MCRYPT_RIJNDAEL_128,
                    $this->secret,
                    substr($str, 16),
                    MCRYPT_MODE_CBC,
                    substr($str, 0, 16)
                )
            );

            if (null !== $str && null !== ($data = json_decode($str, true))) {
                $now = new \DateTime();

                if (isset($data['_expiration']) && $data['_expiration'] <= $now->format(\DateTime::ISO8601)) {
                    unset($data['_expiration']);
                }

                return $data;
            }
        }
    }
}
