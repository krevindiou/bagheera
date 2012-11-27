<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service\Provider;

use Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Service\Provider\ArrayConverter,
    Krevindiou\BagheeraBundle\Service\AccountImportService,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Entity\BankAccess,
    Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Provider base service
 *
 */
abstract class ProviderBase
{
    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var string
     */
    protected $_key;

    /**
     * @var Bank
     */
    protected $_bank;

    /**
     * @var BankAccess
     */
    protected $_bankAccess;

    /**
     * @var AccountImportService
     */
    protected $_accountImportService;

    public function __construct(Logger $logger)
    {
        $this->_logger = $logger;
    }

    public function setKey($key)
    {
        $this->_key = $key;
    }

    public function setBank(Bank $bank)
    {
        $this->_bank = $bank;
    }

    public function setBankAccess(BankAccess $bankAccess)
    {
        $this->_bankAccess = $bankAccess;
    }

    public function setAccountImportService(AccountImportService $accountImportService)
    {
        $this->_accountImportService = $accountImportService;
    }

    /**
     * Decrypts string (used for login and password)
     *
     * @param  string $encryptedString Encrypted string
     * @return string
     */
    protected function _decrypt($encryptedString)
    {
        if (false !== ($encryptedString = base64_decode($encryptedString))) {
            $plainString = trim(
                mcrypt_decrypt(
                    MCRYPT_RIJNDAEL_128,
                    $this->_key,
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
    protected function _convertToArray(Account $account, $data, $format)
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
    protected function _save(Account $account, $data, $type)
    {
        $this->_accountImportService->setData($account, $data, $type);
    }
}
