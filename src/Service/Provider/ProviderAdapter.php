<?php

declare(strict_types=1);

namespace App\Service\Provider;

use App\Entity\Account;
use App\Entity\Bank;
use App\Entity\BankAccess;
use App\Service\AccountImportService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Container\ContainerInterface;
use Symfony\Component\DependencyInjection\Exception\ServiceNotFoundException;

class ProviderAdapter
{
    protected $providerService;
    private $em;
    private $key;
    private $accountImportService;
    private $container;

    public function __construct(
        EntityManagerInterface $em,
        $key,
        AccountImportService $accountImportService,
        ContainerInterface $container
    ) {
        $this->em = $em;
        $this->key = $key;
        $this->accountImportService = $accountImportService;
        $this->container = $container;
    }

    /**
     * Defines BankAccess entity (used to retrieve bank's specific service).
     *
     * @param BankAccess $bankAccess BankAccess entity
     */
    public function setBankAccess(BankAccess $bankAccess): void
    {
        $bank = $this->em->find(Bank::class, $bankAccess->getBankId());

        if (null !== $bank) {
            $provider = $bank->getProvider();

            if (null !== $provider) {
                try {
                    $this->providerService = $this->container->get('app.provider_adapter.'.$provider->getProviderId());
                    $this->providerService->setBank($bank);
                    $this->providerService->setBankAccess($bankAccess);
                    $this->providerService->setKey($this->key);
                    $this->providerService->setAccountImportService($this->accountImportService);
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
    public function connect(): void
    {
        $this->providerService->connect();
    }

    /**
     * Proxy method towards bank's specific method.
     *
     * @see ProviderInterface::fetchAccounts()
     */
    public function fetchAccounts(): array
    {
        try {
            $this->connect();
        } catch (\RuntimeException $e) {
            return [];
        }

        return $this->providerService->fetchAccounts();
    }

    /**
     * Proxy method towards bank's specific method.
     *
     * @see ProviderInterface::fetchTransactions()
     */
    public function fetchTransactions(Account $account): array
    {
        try {
            $this->connect();
        } catch (\RuntimeException $e) {
            return [];
        }

        $data = $this->providerService->fetchTransactions($account);
        if (null === $data) {
            return [];
        }

        $data = $this->normalizeData($account, $data);

        $accountImport = $this->accountImportService->getCurrentImport($account);
        $accountImport->setTotal(count($data));
        $this->em->flush();

        return $data;
    }

    /**
     * Proxy method towards bank's specific method.
     *
     * @see ProviderInterface::normalizeData()
     */
    protected function normalizeData(Account $account, array $data): array
    {
        return $this->providerService->normalizeData($account, $data);
    }
}
