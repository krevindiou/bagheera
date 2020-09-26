<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20190220111002 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Set created_at columns as not nullable';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');

        $this->addSql('ALTER TABLE report ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE member ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE operation_search ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE provider ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE bank_access ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE payment_method ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE category ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE bank ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE account ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE scheduler ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE operation ALTER created_at SET NOT NULL');
        $this->addSql('ALTER TABLE account_import ALTER created_at SET NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');

        $this->addSql('ALTER TABLE bank ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE provider ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE bank_access ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE member ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE account ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE account_import ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE payment_method ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE category ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE scheduler ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE operation_search ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE operation ALTER created_at DROP NOT NULL');
        $this->addSql('ALTER TABLE report ALTER created_at DROP NOT NULL');
    }
}
