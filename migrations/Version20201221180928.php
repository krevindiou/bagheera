<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20201221180928 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Replace 0 values by NULL in debit/credit columns';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');

        $this->addSql('UPDATE operation SET debit = NULL WHERE debit = 0 AND credit > 0');
        $this->addSql('UPDATE operation SET credit = NULL WHERE credit = 0 AND debit > 0');
        $this->addSql('UPDATE scheduler SET debit = NULL WHERE debit = 0 AND credit > 0');
        $this->addSql('UPDATE scheduler SET credit = NULL WHERE credit = 0 AND debit > 0');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');
    }
}
