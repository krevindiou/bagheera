<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20210912164109 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Set notes fields to not nullable';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("UPDATE operation SET notes = '' WHERE notes IS NULL");
        $this->addSql('ALTER TABLE operation ALTER notes SET NOT NULL');
        $this->addSql("UPDATE scheduler SET notes = '' WHERE notes IS NULL");
        $this->addSql('ALTER TABLE scheduler ALTER notes SET NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE scheduler ALTER notes DROP NOT NULL');
        $this->addSql("UPDATE scheduler SET notes = NULL WHERE notes = ''");
        $this->addSql('ALTER TABLE operation ALTER notes DROP NOT NULL');
        $this->addSql("UPDATE operation SET notes = NULL WHERE notes = ''");
    }
}
