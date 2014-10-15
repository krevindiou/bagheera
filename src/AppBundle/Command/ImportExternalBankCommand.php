<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Command;

use Symfony\Bundle\FrameworkBundle\Command\ContainerAwareCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use AppBundle\Entity\Account;

class ImportExternalBankCommand extends ContainerAwareCommand
{
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
        $em = $this->getContainer()->get('doctrine')->getEntityManager();
        $secureEm = $this->getContainer()->get('doctrine')->getEntityManager('secure');

        $bank = $em->find('Model:Bank', $input->getArgument('bank_id'));

        if (null !== $bank) {
            $bankAccess = $secureEm->find('Model:BankAccess', $bank->getBankId());

            if (null !== $bankAccess) {
                $accountService = $this->getContainer()->get('bagheera.account');
                $accountImportService = $this->getContainer()->get('bagheera.account_import');
                $operationService = $this->getContainer()->get('bagheera.operation');

                $provider = $this->getContainer()->get('bagheera.provider_adapter');
                try {
                    $provider->setBankAccess($bankAccess);
                } catch (\RuntimeException $e) {
                    $this->getContainer()->get('logger')->err($e->getMessage());

                    return;
                }

                $accounts = $provider->fetchAccounts();

                $accountService->saveMulti($bank, $accounts);

                // Entity manager needs a refresh to fetch new accounts
                $em->refresh($bank);

                foreach ($bank->getAccounts() as $account) {
                    if (null !== $account->getExternalAccountId()) {
                        $accountImportService->initImport($account);

                        $transactions = $provider->fetchTransactions($account);

                        if (!empty($transactions)) {
                            $operationService->saveMulti(
                                $account,
                                $transactions,
                                function (Account $account, $nb) use ($accountImportService) {
                                    $accountImportService->updateImport($account, $nb);
                                }
                            );
                        }

                        $accountImportService->closeImport($account);
                    }
                }
            }
        }
    }
}
