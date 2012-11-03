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

use Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Service\Provider\ArrayConverter,
    Krevindiou\BagheeraBundle\Service\AccountImportService,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Entity\BankAccess,
    Krevindiou\BagheeraBundle\Entity\Account;

/**
 * Provider base service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
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
