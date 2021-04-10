<?php

declare(strict_types=1);

namespace App\Service\Provider;

use App\Entity\Account;

interface ProviderInterface
{
    /**
     * Connects to bank's provider.
     */
    public function connect(): void;

    /**
     * Fetches accounts into an array.
     */
    public function fetchAccounts(): array;

    /**
     * Fetches transactions into an array.
     *
     * @param Account $account Account entity
     */
    public function fetchTransactions(Account $account): array;

    /**
     * Converts transactions data to normalized format.
     *
     * @param Account $account Account entity
     * @param array   $data    Data to normalize
     */
    public function normalizeData(Account $account, array $data): array;
}
