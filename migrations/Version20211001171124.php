<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20211001171124 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Set notes field to empty string by default';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE operation ALTER notes SET DEFAULT ''");
        $this->addSql("ALTER TABLE scheduler ALTER notes SET DEFAULT ''");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE scheduler ALTER notes DROP DEFAULT');
        $this->addSql('ALTER TABLE operation ALTER notes DROP DEFAULT');
    }
}
