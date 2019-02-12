<?php

namespace App\Service\Provider;

use App\Entity\Account;

interface ProviderInterface
{
    /**
     * Connects to bank's provider.
     */
    public function connect();

    /**
     * Fetches accounts into an array.
     *
     * @return array
     */
    public function fetchAccounts();

    /**
     * Fetches transactions into an array.
     *
     * @param Account $account Account entity
     *
     * @return array
     */
    public function fetchTransactions(Account $account);

    /**
     * Converts transactions data to normalized format.
     *
     * @param Account $accounts Account entity
     * @param array   $data     Data to normalize
     *
     * @return array
     */
    public function normalizeData(Account $account, array $data);
}
