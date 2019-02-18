<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity
 * @ORM\Table(name="account_import")
 */
class AccountImport
{
    /**
     * @var int
     *
     * @ORM\Column(name="import_id", type="integer", nullable=false)
     * @ORM\Id
     */
    protected $importId;

    /**
     * @var int
     *
     * @ORM\Column(name="account_id", type="integer", nullable=false)
     */
    protected $accountId;

    /**
     * @var App\Entity\Account
     *
     * @ORM\ManyToOne(targetEntity="Account")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @ORM\Id
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Account")
     * @Assert\Valid()
     */
    protected $account;

    /**
     * @var int
     *
     * @ORM\Column(name="total", type="integer", nullable=true)
     */
    protected $total = 0;

    /**
     * @var int
     *
     * @ORM\Column(name="progress", type="integer", nullable=true)
     */
    protected $progress = 0;

    /**
     * @var bool
     *
     * @ORM\Column(name="finished", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $finished = false;

    /**
     * @var string
     *
     * @ORM\Column(name="original_data", type="text", nullable=true)
     */
    protected $originalData;

    /**
     * @var string
     *
     * @ORM\Column(name="json_data", type="text", nullable=true)
     */
    protected $jsonData;

    /**
     * @var string
     *
     * @ORM\Column(name="json_normalized_data", type="text", nullable=true)
     */
    protected $jsonNormalizedData;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     */
    protected $updatedAt;

    /**
     * Set importId.
     *
     * @param int $importId
     */
    public function setImportId(int $importId): void
    {
        $this->importId = $importId;
    }

    /**
     * Get importId.
     *
     * @return int
     */
    public function getImportId(): ?int
    {
        return $this->importId;
    }

    /**
     * Set account.
     *
     * @param App\Entity\Account $account
     */
    public function setAccount(Account $account): void
    {
        $this->account = $account;
    }

    /**
     * Get account.
     *
     * @return App\Entity\Account
     */
    public function getAccount(): ?Account
    {
        return $this->account;
    }

    /**
     * Set total.
     *
     * @param int $total
     */
    public function setTotal(int $total): void
    {
        $this->total = $total;
    }

    /**
     * Get total.
     *
     * @return int
     */
    public function getTotal(): ?int
    {
        return $this->total;
    }

    /**
     * Set progress.
     *
     * @param int $progress
     */
    public function setProgress(int $progress): void
    {
        $this->progress = $progress;
    }

    /**
     * Get progress.
     *
     * @return int
     */
    public function getProgress(): ?int
    {
        return $this->progress;
    }

    /**
     * Set finished.
     *
     * @param bool $finished
     */
    public function setFinished(bool $finished): void
    {
        $this->finished = $finished;
    }

    /**
     * Get finished.
     *
     * @return bool
     */
    public function isFinished(): ?bool
    {
        return $this->finished;
    }

    /**
     * Set originalData.
     *
     * @param string originalData
     */
    public function setOriginalData(string $originalData): void
    {
        $this->originalData = $originalData;
    }

    /**
     * Get originalData.
     *
     * @return string
     */
    public function getOriginalData(): ?string
    {
        return $this->originalData;
    }

    /**
     * Set jsonData.
     *
     * @param string jsonData
     */
    public function setJsonData(string $jsonData): void
    {
        $this->jsonData = $jsonData;
    }

    /**
     * Get jsonData.
     *
     * @return string
     */
    public function getJsonData(): ?string
    {
        return $this->jsonData;
    }

    /**
     * Set jsonNormalizedData.
     *
     * @param string jsonNormalizedData
     */
    public function setJsonNormalizedData(string $jsonNormalizedData): void
    {
        $this->jsonNormalizedData = $jsonNormalizedData;
    }

    /**
     * Get jsonNormalizedData.
     *
     * @return string
     */
    public function getJsonNormalizedData(): ?string
    {
        return $this->jsonNormalizedData;
    }

    /**
     * Get createdAt.
     *
     * @return DateTime
     */
    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    /**
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }

    /**
     * Returns current import progress.
     *
     * @return int
     */
    public function getProgressPct(): int
    {
        $pct = 0;

        if ($this->isFinished()) {
            $pct = 100;
        } elseif ((int) $this->getTotal() > 0) {
            $pct = floor($this->getProgress() / $this->getTotal() * 100);
        }

        return $pct;
    }
}
