<?php

namespace AppBundle\Service\Provider;

use Symfony\Component\DependencyInjection\Exception\ServiceNotFoundException;
use JMS\DiExtraBundle\Annotation as DI;
use AppBundle\Entity\Account;
use AppBundle\Entity\BankAccess;

/**
 * @DI\Service("app.provider_adapter")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "provider_adapter"})
 */
class ProviderAdapter
{
    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("%secret%") */
    public $key;

    /** @DI\Inject("app.account_import") */
    public $accountImportService;

    /** @DI\Inject("service_container") */
    public $container;

    /**
     * @var ProviderService
     */
    protected $providerService;

    /**
     * Defines BankAccess entity (used to retrieve bank's specific service).
     *
     * @param BankAccess $bankAccess BankAccess entity
     */
    public function setBankAccess(BankAccess $bankAccess)
    {
        $bank = $this->em->find('AppBundle:Bank', $bankAccess->getBankId());

        if (null !== $bank) {
            $provider = $bank->getProvider();

            if (null !== $provider) {
                try {
                    $providerService = $this->container->get('app.provider_adapter.'.$provider->getProviderId());
                    $providerService->setBank($bank);
                    $providerService->setBankAccess($bankAccess);
                    $providerService->setKey($this->key);
                    $providerService->setAccountImportService($this->accountImportService);

                    $this->providerService = $providerService;
                } catch (ServiceNotFoundException $e) {
                }
            }
        }

        if (null === $this->providerService) {
            throw new \RuntimeException(sprintf('Unable to find provider for bank id %d', $bankAccess->getBankId()));
        }
    }

    /**
     * Proxy method towards bank's specific method.
     *
     * @see ProviderInterface::connect()
     */
    public function connect()
    {
        return $this->providerService->connect();
    }

    /**
     * Proxy method towards bank's specific method.
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

        return $this->providerService->fetchAccounts();
    }

    /**
     * Proxy method towards bank's specific method.
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

        $data = $this->providerService->fetchTransactions($account);

        if (null !== $data) {
            $data = $this->normalizeData($account, $data);

            $accountImport = $this->accountImportService->getCurrentImport($account);
            $accountImport->setTotal(count($data));
            $this->em->flush();

            return $data;
        }
    }

    /**
     * Proxy method towards bank's specific method.
     *
     * @see ProviderInterface::normalizeData()
     */
    protected function normalizeData(Account $account, array $data)
    {
        return $this->providerService->normalizeData($account, $data);
    }
}
