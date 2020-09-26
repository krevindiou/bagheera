<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20190220112636 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Rename some unique keys';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');

        $this->addSql('ALTER INDEX member_email_key RENAME TO member_email_unique');
        $this->addSql('ALTER INDEX operation_transfer_operation_id_key RENAME TO operation_transfer_operation_id_unique');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');

        $this->addSql('ALTER INDEX member_email_unique RENAME TO member_email_key');
        $this->addSql('ALTER INDEX operation_transfer_operation_id_unique RENAME TO operation_transfer_operation_id_key');
    }
}
