<?php

namespace App\Command;

use Psr\Log\LoggerInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Command\ContainerAwareCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use App\Entity\Account;
use App\Service\AccountService;
use App\Service\AccountImportService;
use App\Service\OperationService;
use App\Service\Provider\ProviderAdapter;

class ImportExternalBankCommand extends ContainerAwareCommand
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
    )
    {
        $this->logger = $logger;
        $this->em = $em;
        $this->emSecure = $emSecure;
        $this->accountService = $accountService;
        $this->accountImportService = $accountImportService;
        $this->operationService = $operationService;
        $this->provider = $provider;
        parent::__construct();
    }

    protected function configure()
    {
        $this
            ->setName('bagheera:import_external_bank')
            ->setDescription('Imports bank data from online bank')
            ->addArgument('bank_id', InputArgument::REQUIRED, 'Bank id to import')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output)
    {
        $bank = $this->em->find('App:Bank', $input->getArgument('bank_id'));

        if (null !== $bank) {
            $bankAccess = $this->emSecure->find('App:BankAccess', $bank->getBankId());

            if (null !== $bankAccess) {
                try {
                    $this->provider->setBankAccess($bankAccess);
                } catch (\RuntimeException $e) {
                    $this->logger->err($e->getMessage());

                    return;
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
                                function (Account $account, $nb) {
                                    $this->accountImportService->updateImport($account, $nb);
                                }
                            );
                        }

                        $this->accountImportService->closeImport($account);
                    }
                }
            }
        }
    }
}
