<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service\Provider;

use Symfony\Bridge\Monolog\Logger;
use Krevindiou\BagheeraBundle\Service\Provider\ArrayConverter;
use Krevindiou\BagheeraBundle\Service\AccountImportService;
use Krevindiou\BagheeraBundle\Entity\Bank;
use Krevindiou\BagheeraBundle\Entity\BankAccess;
use Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Provider base service
 *
 */
abstract class ProviderBase
{
    /**
     * @var Logger
     */
    public $logger;

    /**
     * @var string
     */
    public $key;

    /**
     * @var Bank
     */
    public $bank;

    /**
     * @var BankAccess
     */
    public $bankAccess;

    /**
     * @var AccountImportService
     */
    public $accountImportService;

    public function __construct(Logger $logger)
    {
        $this->logger = $logger;
    }

    public function setKey($key)
    {
        $this->key = $key;
    }

    public function setBank(Bank $bank)
    {
        $this->bank = $bank;
    }

    public function setBankAccess(BankAccess $bankAccess)
    {
        $this->bankAccess = $bankAccess;
    }

    public function setAccountImportService(AccountImportService $accountImportService)
    {
        $this->accountImportService = $accountImportService;
    }

    /**
     * Decrypts string (used for login and password)
     *
     * @param  string $encryptedString Encrypted string
     * @return string
     */
    protected function decrypt($encryptedString)
    {
        if (false !== ($encryptedString = base64_decode($encryptedString))) {
            $plainString = trim(
                mcrypt_decrypt(
                    MCRYPT_RIJNDAEL_128,
                    $this->key,
                    substr($encryptedString, 16),
                    MCRYPT_MODE_CBC,
                    substr($encryptedString, 0, 16)
                )
            );

            return $plainString;
        }
    }

    /**
     * Converts transactions data to an array
     *
     * @param  Account $account Account entity
     * @param  string  $data    Data to convert
     * @param  string  $format  Either QIF, OFX or QFX
     * @return array
     */
    protected function convertToArray(Account $account, $data, $format)
    {
        try {
            $data = ArrayConverter::convertFromFormat($data, $format);

            $this->_save($account, json_encode($data), 'json');

            return $data;
        } catch (InvalidArgumentException $e) {
            throw $e;
        }
    }

    /**
     * Saves transactions data depending on type
     *
     * @param  Account $account Account entity
     * @param  string  $data    Data to save
     * @param  string  $type    Either original, json or json_normalized
     * @return void
     */
    protected function save(Account $account, $data, $type)
    {
        $this->accountImportService->setData($account, $data, $type);
    }
}
