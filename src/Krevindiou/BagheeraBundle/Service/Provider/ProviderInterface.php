<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Service\Provider;

use Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Provider interface
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
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
