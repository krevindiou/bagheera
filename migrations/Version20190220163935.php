<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20190220163935 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Store amounts as ten-thousandth of the monetary unit';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');

        $this->addSql('UPDATE account SET overdraft_facility = overdraft_facility * 10000');
        $this->addSql('UPDATE scheduler SET debit = debit * 10000');
        $this->addSql('UPDATE scheduler SET credit = credit * 10000');
        $this->addSql('UPDATE operation SET debit = debit * 10000');
        $this->addSql('UPDATE operation SET credit = credit * 10000');
        $this->addSql('UPDATE operation_search SET amount_inferior_to = amount_inferior_to * 10000');
        $this->addSql('UPDATE operation_search SET amount_inferior_or_equal_to = amount_inferior_or_equal_to * 10000');
        $this->addSql('UPDATE operation_search SET amount_equal_to = amount_equal_to * 10000');
        $this->addSql('UPDATE operation_search SET amount_superior_or_equal_to = amount_superior_or_equal_to * 10000');
        $this->addSql('UPDATE operation_search SET amount_superior_to = amount_superior_to * 10000');

        $this->addSql('CREATE DOMAIN bagheera_money AS INT');

        $this->addSql('ALTER TABLE account ALTER overdraft_facility TYPE bagheera_money');
        $this->addSql('ALTER TABLE scheduler ALTER debit TYPE bagheera_money');
        $this->addSql('ALTER TABLE scheduler ALTER credit TYPE bagheera_money');
        $this->addSql('ALTER TABLE operation ALTER debit TYPE bagheera_money');
        $this->addSql('ALTER TABLE operation ALTER credit TYPE bagheera_money');
        $this->addSql('ALTER TABLE operation_search ALTER amount_inferior_to TYPE bagheera_money');
        $this->addSql('ALTER TABLE operation_search ALTER amount_inferior_or_equal_to TYPE bagheera_money');
        $this->addSql('ALTER TABLE operation_search ALTER amount_equal_to TYPE bagheera_money');
        $this->addSql('ALTER TABLE operation_search ALTER amount_superior_or_equal_to TYPE bagheera_money');
        $this->addSql('ALTER TABLE operation_search ALTER amount_superior_to TYPE bagheera_money');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf('postgresql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'postgresql\'.');

        $this->addSql('ALTER TABLE account ALTER overdraft_facility TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE scheduler ALTER debit TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE scheduler ALTER credit TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE operation ALTER debit TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE operation ALTER credit TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE operation_search ALTER amount_inferior_to TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE operation_search ALTER amount_inferior_or_equal_to TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE operation_search ALTER amount_equal_to TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE operation_search ALTER amount_superior_or_equal_to TYPE NUMERIC(10,2)');
        $this->addSql('ALTER TABLE operation_search ALTER amount_superior_to TYPE NUMERIC(10,2)');

        $this->addSql('DROP DOMAIN bagheera_money');

        $this->addSql('UPDATE account SET overdraft_facility = overdraft_facility / 10000');
        $this->addSql('UPDATE scheduler SET debit = debit / 10000');
        $this->addSql('UPDATE scheduler SET credit = credit / 10000');
        $this->addSql('UPDATE operation SET debit = debit / 10000');
        $this->addSql('UPDATE operation SET credit = credit / 10000');
        $this->addSql('UPDATE operation_search SET amount_inferior_to = amount_inferior_to / 10000');
        $this->addSql('UPDATE operation_search SET amount_inferior_or_equal_to = amount_inferior_or_equal_to / 10000');
        $this->addSql('UPDATE operation_search SET amount_equal_to = amount_equal_to / 10000');
        $this->addSql('UPDATE operation_search SET amount_superior_or_equal_to = amount_superior_or_equal_to / 10000');
        $this->addSql('UPDATE operation_search SET amount_superior_to = amount_superior_to / 10000');
    }
}
