<?php

namespace AppBundle\Entity;

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
     * @var AppBundle\Entity\Account
     *
     * @ORM\ManyToOne(targetEntity="Account")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @ORM\Id
     * @Assert\NotNull()
     * @Assert\Type(type="AppBundle\Entity\Account")
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
    public function setImportId($importId)
    {
        $this->importId = $importId;
    }

    /**
     * Get importId.
     *
     * @return int
     */
    public function getImportId()
    {
        return $this->importId;
    }

    /**
     * Set account.
     *
     * @param AppBundle\Entity\Account $account
     */
    public function setAccount(Account $account)
    {
        $this->account = $account;
    }

    /**
     * Get account.
     *
     * @return AppBundle\Entity\Account
     */
    public function getAccount()
    {
        return $this->account;
    }

    /**
     * Set total.
     *
     * @param int $total
     */
    public function setTotal($total)
    {
        $this->total = $total;
    }

    /**
     * Get total.
     *
     * @return int
     */
    public function getTotal()
    {
        return $this->total;
    }

    /**
     * Set progress.
     *
     * @param int $progress
     */
    public function setProgress($progress)
    {
        $this->progress = $progress;
    }

    /**
     * Get progress.
     *
     * @return int
     */
    public function getProgress()
    {
        return $this->progress;
    }

    /**
     * Set finished.
     *
     * @param bool $finished
     */
    public function setFinished($finished)
    {
        $this->finished = (bool) $finished;
    }

    /**
     * Get finished.
     *
     * @return bool
     */
    public function isFinished()
    {
        return $this->finished;
    }

    /**
     * Set originalData.
     *
     * @param string originalData
     */
    public function setOriginalData($originalData)
    {
        $this->originalData = $originalData;
    }

    /**
     * Get originalData.
     *
     * @return string
     */
    public function getOriginalData()
    {
        return $this->originalData;
    }

    /**
     * Set jsonData.
     *
     * @param string jsonData
     */
    public function setJsonData($jsonData)
    {
        $this->jsonData = $jsonData;
    }

    /**
     * Get jsonData.
     *
     * @return string
     */
    public function getJsonData()
    {
        return $this->jsonData;
    }

    /**
     * Set jsonNormalizedData.
     *
     * @param string jsonNormalizedData
     */
    public function setJsonNormalizedData($jsonNormalizedData)
    {
        $this->jsonNormalizedData = $jsonNormalizedData;
    }

    /**
     * Get jsonNormalizedData.
     *
     * @return string
     */
    public function getJsonNormalizedData()
    {
        return $this->jsonNormalizedData;
    }

    /**
     * Get createdAt.
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->createdAt;
    }

    /**
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }

    /**
     * Returns current import progress.
     *
     * @return int
     */
    public function getProgressPct()
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
