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

namespace Krevindiou\BagheeraBundle\Command;

use Symfony\Bundle\FrameworkBundle\Command\ContainerAwareCommand,
    Symfony\Component\Console\Input\InputArgument,
    Symfony\Component\Console\Input\InputInterface,
    Symfony\Component\Console\Output\OutputInterface,
    Krevindiou\BagheeraBundle\Entity\Account;

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

        $bank = $em->find('KrevindiouBagheeraBundle:Bank', $input->getArgument('bank_id'));

        if (null !== $bank) {
            $bankAccess = $secureEm->find('KrevindiouBagheeraBundle:BankAccess', $bank->getBankId());

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

                $accountService->saveMulti($bank->getUser(), $bank, $accounts);

                // Entity manager needs a refresh to fetch new accounts
                $em->refresh($bank);

                foreach ($bank->getAccounts() as $account) {
                    if (null !== $account->getExternalAccountId()) {
                        $accountImportService->initImport($account);

                        $transactions = $provider->fetchTransactions($account);

                        if (!empty($transactions)) {
                            $operationService->saveMulti(
                                $bank->getUser(),
                                $account,
                                $transactions,
                                function(Account $account, $nb) use ($accountImportService) {
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
