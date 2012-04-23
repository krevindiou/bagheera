<?php

namespace Krevindiou\BagheeraBundle\Command;

use Symfony\Bundle\FrameworkBundle\Command\ContainerAwareCommand,
    Symfony\Component\Console\Input\InputArgument,
    Symfony\Component\Console\Input\InputInterface,
    Symfony\Component\Console\Output\OutputInterface;

class ImportExternalTransactionsCommand extends ContainerAwareCommand
{
    protected function configure()
    {
        $this
            ->setName('bagheera:import_external_transactions')
            ->addArgument('account_id', InputArgument::REQUIRED, 'Account to import')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output)
    {
        $em = $this->getContainer()->get('doctrine.orm.entity_manager');

        $max = 10000;

        $accountId = $input->getArgument('account_id');

        $account = $em->find('KrevindiouBagheeraBundle:Account', $accountId);
        if (null !== $account && null !== $account->getExternalAccountId()) {
            $operationService = $this->getContainer()->get('bagheera.operation');

            $providerFactory = $this->getContainer()->get('bagheera.provider_factory');
            $provider = $providerFactory->get($account->getBank());
            if (null !== $provider) {
                for ($i = 0; ; $i++) {
                    $lastExternalOperationId = $em->getRepository('KrevindiouBagheeraBundle:Operation')->getLastExternalOperationId($account);

                    $externalTransactions = $provider->retrieveTransactions(
                        $account->getBank()->getExternalUserId(),
                        $account->getExternalAccountId(),
                        $lastExternalOperationId,
                        $max
                    );

                    // Always call "saveExternalTransactions" for the first query (even if there's no results)
                    if ($i == 0 || !empty($externalTransactions)) {
                        $operationService->saveExternalTransactions(
                            $account->getBank()->getUser(),
                            $account,
                            $externalTransactions
                        );
                    }

                    if (empty($externalTransactions) || count($externalTransactions) < $max) {
                        break;
                    }
                }
            }
        }
    }
}
