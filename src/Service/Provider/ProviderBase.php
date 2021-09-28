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
    public Logger $logger;
    public string $key;
    public Bank $bank;
    public BankAccess $bankAccess;
    public AccountImportService $accountImportService;

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
     */
    protected function convertToArray(Account $account, string $data, string $format): array
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
     */
    protected function save(Account $account, string $data, string $type): void
    {
        $this->accountImportService->setData($account, $data, $type);
    }
}
