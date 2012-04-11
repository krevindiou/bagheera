<?php

namespace Krevindiou\BagheeraBundle\Command;

use Symfony\Bundle\FrameworkBundle\Command\ContainerAwareCommand,
    Symfony\Component\Console\Input\InputArgument,
    Symfony\Component\Console\Input\InputInterface,
    Symfony\Component\Console\Input\ArrayInput,
    Symfony\Component\Console\Output\OutputInterface;

class ImportExternalAccountsCommand extends ContainerAwareCommand
{
    protected function configure()
    {
        $this
            ->setName('bagheera:import_external_accounts')
            ->addArgument('bank_id', InputArgument::REQUIRED, 'Bank to import')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output)
    {
        $em = $this->getContainer()->get('doctrine.orm.entity_manager');

        $bankId = $input->getArgument('bank_id');

        $bank = $em->find('KrevindiouBagheeraBundle:Bank', $bankId);
        if (null !== $bank && null !== $bank->getExternalUserId()) {
            $accountService = $this->getContainer()->get('bagheera.account');

            $providerFactory = $this->getContainer()->get('bagheera.provider_factory');
            $provider = $providerFactory->get($bank);
            if (null !== $provider) {
                $externalAccounts = $provider->retrieveAccounts($bank->getExternalUserId());

                $externalAccountsLabel = array();
                foreach ($externalAccounts as $externalAccount) {
                    $externalAccountsLabel[] = $externalAccount['label'];
                }
                $output->writeln(sprintf('Importing accounts: %s', implode(', ', $externalAccountsLabel)));


                $accountService->saveExternalAccounts($bank->getUser(), $bank, $externalAccounts);

                // Import external transactions
                foreach ($externalAccounts as $externalAccount) {
                    $account = $em->getRepository('KrevindiouBagheeraBundle:Account')->findOneBy(
                        array(
                            'bankId' => $bank->getBankId(),
                            'externalAccountId' => $externalAccount['account_id']
                        )
                    );

                    if (null === $account) {
                        continue;
                    }

                    $command = $this->getApplication()->find('bagheera:import_external_transactions');

                    $arguments = array(
                        'command' => 'bagheera:import_external_transactions',
                        'account_id' => $account->getAccountId(),
                    );

                    $command->run(new ArrayInput($arguments), $output);
                }
            }
        }
    }
}
