<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service\Provider;

use Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Provider interface
 *
 */
interface ProviderInterface
{
    /**
     * Connects to bank's provider
     *
     * @return void
     */
    public function connect();

    /**
     * Fetches accounts into an array
     *
     * @return array
     */
    public function fetchAccounts();

    /**
     * Fetches transactions into an array
     *
     * @param  Account $account Account entity
     * @return array
     */
    public function fetchTransactions(Account $account);

    /**
     * Converts transactions data to normalized format
     *
     * @param  Account $accounts Account entity
     * @param  array   $data     Data to normalize
     * @return array
     */
    public function normalizeData(Account $account, array $data);
}
