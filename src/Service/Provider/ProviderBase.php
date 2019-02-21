<?php

declare(strict_types=1);

namespace App\Service\Provider;

use App\Entity\Account;
use App\Entity\Bank;
use App\Entity\BankAccess;
use App\Service\AccountImportService;
use Symfony\Bridge\Monolog\Logger;

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

    public function setKey(string $key): void
    {
        $this->key = $key;
    }

    public function setBank(Bank $bank): void
    {
        $this->bank = $bank;
    }

    public function setBankAccess(BankAccess $bankAccess): void
    {
        $this->bankAccess = $bankAccess;
    }

    public function setAccountImportService(AccountImportService $accountImportService): void
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
    protected function convertToArray(Account $account, string $data, string $format)
    {
        try {
            $data = ArrayConverter::convertFromFormat($data, $format);

            $this->save($account, json_encode($data), 'json');

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
    protected function save(Account $account, string $data, string $type): void
    {
        $this->accountImportService->setData($account, $data, $type);
    }
}
