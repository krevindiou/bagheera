<?php

namespace AppBundle\Service\Provider;

use Symfony\Bridge\Monolog\Logger;
use AppBundle\Service\AccountImportService;
use AppBundle\Entity\Bank;
use AppBundle\Entity\BankAccess;
use AppBundle\Entity\Account;

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
     * Converts transactions data to an array.
     *
     * @param Account $account Account entity
     * @param string  $data    Data to convert
     * @param string  $format  Either QIF, OFX or QFX
     *
     * @return array
     */
    protected function convertToArray(Account $account, $data, $format)
    {
        try {
            $data = ArrayConverter::convertFromFormat($data, $format);

            $this->_save($account, json_encode($data), 'json');

            return $data;
        } catch (\InvalidArgumentException $e) {
            throw $e;
        }
    }

    /**
     * Saves transactions data depending on type.
     *
     * @param Account $account Account entity
     * @param string  $data    Data to save
     * @param string  $type    Either original, json or json_normalized
     */
    protected function save(Account $account, $data, $type)
    {
        $this->accountImportService->setData($account, $data, $type);
    }
}
