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

use Doctrine\ORM\EntityManager,
    Symfony\Component\DependencyInjection\Container,
    Symfony\Component\DependencyInjection\Exception\ServiceNotFoundException,
    Krevindiou\BagheeraBundle\Service\AccountImportService,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\BankAccess;

/**
 * Provider adapter service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class ProviderAdapter
{
    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var string
     */
    protected $_key;

    /**
     * @var AccountImportService
     */
    protected $_accountImportService;

    /**
     * @var Container
     */
    protected $_container;

    /**
     * @var ProviderService
     */
    protected $_providerService;

    public function __construct(
        EntityManager $em,
        $key,
        AccountImportService $accountImportService,
        Container $container)
    {
        $this->_em = $em;
        $this->_key = $key;
        $this->_accountImportService = $accountImportService;
        $this->_container = $container;
    }

    /**
     * Defines BankAccess entity (used to retrieve bank's specific service)
     *
     * @param BankAccess $bankAccess BankAccess entity
     */
    public function setBankAccess(BankAccess $bankAccess)
    {
        $bank = $this->_em->find('KrevindiouBagheeraBundle:Bank', $bankAccess->getBankId());

        if (null !== $bank) {
            $provider = $bank->getProvider();

            if (null !== $provider) {
                try {
                    $providerService = $this->_container->get('bagheera.provider_adapter.' . $provider->getProviderId());
                    $providerService->setBank($bank);
                    $providerService->setBankAccess($bankAccess);
                    $providerService->setKey($this->_key);
                    $providerService->setAccountImportService($this->_accountImportService);

                    $this->_providerService = $providerService;
                } catch (ServiceNotFoundException $e) {
                }
            }
        }

        if (null === $this->_providerService) {
            throw new \RuntimeException(sprintf('Unable to find provider for bank id %d', $bankAccess->getBankId()));
        }
    }

    /**
     * Proxy method towards bank's specific method
     *
     * @see ProviderInterface::connect()
     */
    public function connect()
    {
        return $this->_providerService->connect();
    }

    /**
     * Proxy method towards bank's specific method
     *
     * @see ProviderInterface::fetchAccounts()
     */
    public function fetchAccounts()
    {
        try {
            $this->connect();
        } catch (\RuntimeException $e) {
            return;
        }

        return $this->_providerService->fetchAccounts();
    }

    /**
     * Proxy method towards bank's specific method
     *
     * @see ProviderInterface::fetchTransactions()
     */
    public function fetchTransactions(Account $account)
    {
        try {
            $this->connect();
        } catch (\RuntimeException $e) {
            return;
        }

        $data = $this->_providerService->fetchTransactions($account);

        if (null !== $data) {
            $data = $this->_normalizeData($account, $data);

            $accountImport = $this->_accountImportService->getCurrentImport($account);
            $accountImport->setTotal(count($data));
            $this->_em->flush();

            return $data;
        }
    }

    /**
     * Proxy method towards bank's specific method
     *
     * @see ProviderInterface::normalizeData()
     */
    protected function _normalizeData(Account $account, array $data)
    {
        return $this->_providerService->normalizeData($account, $data);
    }
}
