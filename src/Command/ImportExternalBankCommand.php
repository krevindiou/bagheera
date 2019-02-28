<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Account;
use App\Service\AccountImportService;
use App\Service\AccountService;
use App\Service\OperationService;
use App\Service\Provider\ProviderAdapter;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class ImportExternalBankCommand extends Command
{
    private $logger;
    private $em;
    private $emSecure;
    private $accountService;
    private $accountImportService;
    private $operationService;
    private $provider;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        EntityManagerInterface $emSecure,
        AccountService $accountService,
        AccountImportService $accountImportService,
        OperationService $operationService,
        ProviderAdapter $provider
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->emSecure = $emSecure;
        $this->accountService = $accountService;
        $this->accountImportService = $accountImportService;
        $this->operationService = $operationService;
        $this->provider = $provider;
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->setName('bagheera:import_external_bank')
            ->setDescription('Imports bank data from online bank')
            ->addArgument('bank_id', InputArgument::REQUIRED, 'Bank id to import')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output): ?int
    {
        $bank = $this->em->find('App:Bank', $input->getArgument('bank_id'));
        if (null === $bank) {
            return null;
        }

        $bankAccess = $this->emSecure->find('App:BankAccess', $bank->getBankId());
        if (null === $bankAccess) {
            return null;
        }

        try {
            $this->provider->setBankAccess($bankAccess);
        } catch (\RuntimeException $e) {
            $this->logger->err($e->getMessage());

            return 1;
        }

        $accounts = $this->provider->fetchAccounts();

        $this->accountService->saveMulti($bank, $accounts);

        // Entity manager needs a refresh to fetch new accounts
        $this->em->refresh($bank);

        foreach ($bank->getAccounts() as $account) {
            if (null !== $account->getExternalAccountId()) {
                $this->accountImportService->initImport($account);

                $transactions = $this->provider->fetchTransactions($account);

                if (!empty($transactions)) {
                    $this->operationService->saveMulti(
                        $account,
                        $transactions,
                        function (Account $account, $nb): void {
                            $this->accountImportService->updateImport($account, $nb);
                        }
                    );
                }

                $this->accountImportService->closeImport($account);
            }
        }

        return 0;
    }
}
