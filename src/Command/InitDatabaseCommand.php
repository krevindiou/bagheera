<?php

declare(strict_types=1);

namespace App\Command;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class InitDatabaseCommand extends Command
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->setName('bagheera:init-database')
            ->setDescription('Imports SQL files into an empty database')
            ->addArgument('files', InputArgument::IS_ARRAY | InputArgument::REQUIRED, 'Files to import')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output): ?int
    {
        if (!$this->isDatabaseEmpty()) {
            throw new \Exception('This command requires the database to be empty');
        }

        foreach ($input->getArgument('files') as $file) {
            if (!is_readable($file)) {
                throw new \Exception(sprintf('Unable to read "%s" file', $file));
            }
        }

        foreach ($input->getArgument('files') as $file) {
            $this->em->getConnection()->exec(file_get_contents($file));
        }

        $this->em->flush();

        return 0;
    }

    private function isDatabaseEmpty(): bool
    {
        return 0 === count($this->em->getConnection()->getSchemaManager()->listTables());
    }
}
