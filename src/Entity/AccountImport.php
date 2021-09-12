<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\AccountImportRepository;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\ManyToOne;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity(repositoryClass: AccountImportRepository::class)]
#[Table(name: 'account_import')]
class AccountImport
{
    use TimestampableTrait;

    #[Id, Column(name: 'import_id', type: 'integer')]
    protected ?int $importId = null;

    #[Column(name: 'account_id', type: 'integer')]
    protected int $accountId;

    #[Assert\NotNull]
    #[Assert\Type(type: Account::class)]
    #[Assert\Valid]
    #[ManyToOne(targetEntity: Account::class)]
    #[JoinColumn(name: 'account_id', referencedColumnName: 'account_id')]
    protected ?Account $account = null;

    #[Column(name: 'total', type: 'integer', nullable: true)]
    protected ?int $total = 0;

    #[Column(name: 'progress', type: 'integer', nullable: true)]
    protected ?int $progress = 0;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'finished', type: 'boolean', options: ['default' => false])]
    protected ?bool $finished = false;

    #[Column(name: 'original_data', type: 'text', nullable: true)]
    protected ?string $originalData = null;

    #[Column(name: 'json_data', type: 'text', nullable: true)]
    protected ?string $jsonData = null;

    #[Column(name: 'json_normalized_data', type: 'text', nullable: true)]
    protected ?string $jsonNormalizedData = null;

    public function setImportId(int $importId): void
    {
        $this->importId = $importId;
    }

    public function getImportId(): ?int
    {
        return $this->importId;
    }

    public function setAccount(Account $account): void
    {
        $this->account = $account;
    }

    public function getAccount(): ?Account
    {
        return $this->account;
    }

    public function setTotal(int $total): void
    {
        $this->total = $total;
    }

    public function getTotal(): ?int
    {
        return $this->total;
    }

    public function setProgress(int $progress): void
    {
        $this->progress = $progress;
    }

    public function getProgress(): ?int
    {
        return $this->progress;
    }

    public function setFinished(bool $finished): void
    {
        $this->finished = $finished;
    }

    public function isFinished(): ?bool
    {
        return $this->finished;
    }

    public function setOriginalData(string $originalData): void
    {
        $this->originalData = $originalData;
    }

    public function getOriginalData(): ?string
    {
        return $this->originalData;
    }

    public function setJsonData(string $jsonData): void
    {
        $this->jsonData = $jsonData;
    }

    public function getJsonData(): ?string
    {
        return $this->jsonData;
    }

    public function setJsonNormalizedData(string $jsonNormalizedData): void
    {
        $this->jsonNormalizedData = $jsonNormalizedData;
    }

    public function getJsonNormalizedData(): ?string
    {
        return $this->jsonNormalizedData;
    }

    public function getProgressPct(): int
    {
        $pct = 0;

        if ($this->isFinished()) {
            $pct = 100;
        } elseif ((int) $this->getTotal() > 0) {
            $pct = (int) floor($this->getProgress() / $this->getTotal() * 100);
        }

        return $pct;
    }
}
