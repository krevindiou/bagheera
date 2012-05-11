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

/**
 * Axa Banque provider service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AxaBanqueProviderService extends ProviderService
{
    public function retrieveAccounts($userId)
    {
        $data = $this->_request(
            sprintf('/customers/%s/accounts', $userId),
            array(
                'customer_id' => $userId
            )
        );

        foreach ($data as $k => $v) {
            $data[$k]['account_id'] = $data[$k]['id'];
            $data[$k]['iban'] = implode('', $data[$k]['iban']);

            unset($data[$k]['account']);
        }

        return $data;
    }

    public function retrieveTransactions($userId, $accountId, $sinceTransactionid = null, $count = null)
    {
        $params = array(
            'customer_id' => $userId
        );

        if (null !== $sinceTransactionid) {
            $params['since_id'] = $sinceTransactionid;
        }

        if (null !== $count) {
            $params['count'] = $count;
        }

        $data = $this->_request(
            sprintf('/accounts/%s/transactions', $accountId),
            $params
        );

        $data = $data['transactions'];

        foreach ($data as $k => $v) {
            $data[$k]['transaction_id'] = $data[$k]['id'];
            $data[$k]['account_id'] = $data[$k]['account'];
            $data[$k]['value_date'] = $data[$k]['date'];

            $paymentMethods = array(
                'credit' => 'credit_card',
                'debit' => 'credit_card',
                'deposit' => 'deposit',
                'transfer' => 'transfer',
                'check' => 'check',
            );

            $data[$k]['payment_method'] = isset($paymentMethods[$data[$k]['type']]) ? $paymentMethods[$data[$k]['type']] : null;

            unset(
                $data[$k]['id'],
                $data[$k]['account'],
                $data[$k]['date'],
                $data[$k]['accounting_date'],
                $data[$k]['type']
            );
        }

        return $data;
    }
}
