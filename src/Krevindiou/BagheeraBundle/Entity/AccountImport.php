<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Krevindiou\BagheeraBundle\Entity\AccountImport
 *
 * @ORM\Entity
 * @ORM\Table(name="account_import")
 * @ORM\HasLifecycleCallbacks()
 */
class AccountImport
{
    /**
     * @var integer $importId
     *
     * @ORM\Column(name="import_id", type="integer", nullable=false)
     * @ORM\Id
     */
    protected $importId;

    /**
     * @var integer $accountId
     *
     * @ORM\Column(name="account_id", type="integer", nullable=false)
     */
    protected $accountId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Account $account
     *
     * @ORM\ManyToOne(targetEntity="Account")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @ORM\Id
     * @Assert\NotBlank()
     * @Assert\Valid()
     */
    protected $account;

    /**
     * @var integer $total
     *
     * @ORM\Column(name="total", type="integer", nullable=true)
     */
    protected $total = 0;

    /**
     * @var integer $progress
     *
     * @ORM\Column(name="progress", type="integer", nullable=true)
     */
    protected $progress = 0;

    /**
     * @var boolean $finished
     *
     * @ORM\Column(name="finished", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $finished = false;

    /**
     * @var string $originalData
     *
     * @ORM\Column(name="original_data", type="text", nullable=true)
     */
    protected $originalData;

    /**
     * @var string $jsonData
     *
     * @ORM\Column(name="json_data", type="text", nullable=true)
     */
    protected $jsonData;

    /**
     * @var string $jsonNormalizedData
     *
     * @ORM\Column(name="json_normalized_data", type="text", nullable=true)
     */
    protected $jsonNormalizedData;

    /**
     * @var DateTime $createdAt
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     * @Assert\DateTime()
     */
    protected $createdAt;

    /**
     * @var DateTime $updatedAt
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     * @Assert\DateTime()
     */
    protected $updatedAt;

    /**
     * @ORM\PrePersist
     */
    public function prePersist()
    {
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\PreUpdate
     */
    public function preUpdate()
    {
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * Set importId
     *
     * @param integer $importId
     */
    public function setImportId($importId)
    {
        $this->importId = $importId;
    }

    /**
     * Get importId
     *
     * @return integer
     */
    public function getImportId()
    {
        return $this->importId;
    }

    /**
     * Set account
     *
     * @param Krevindiou\BagheeraBundle\Entity\Account $account
     */
    public function setAccount(Account $account)
    {
        $this->account = $account;
    }

    /**
     * Get account
     *
     * @return Krevindiou\BagheeraBundle\Entity\Account
     */
    public function getAccount()
    {
        return $this->account;
    }

    /**
     * Set total
     *
     * @param integer $total
     */
    public function setTotal($total)
    {
        $this->total = $total;
    }

    /**
     * Get total
     *
     * @return integer
     */
    public function getTotal()
    {
        return $this->total;
    }

    /**
     * Set progress
     *
     * @param integer $progress
     */
    public function setProgress($progress)
    {
        $this->progress = $progress;
    }

    /**
     * Get progress
     *
     * @return integer
     */
    public function getProgress()
    {
        return $this->progress;
    }

    /**
     * Set finished
     *
     * @param boolean $finished
     */
    public function setFinished($finished)
    {
        $this->finished = (bool) $finished;
    }

    /**
     * Get finished
     *
     * @return boolean
     */
    public function isFinished()
    {
        return $this->finished;
    }

    /**
     * Set originalData
     *
     * @param string originalData
     */
    public function setOriginalData($originalData)
    {
        $this->originalData = $originalData;
    }

    /**
     * Get originalData
     *
     * @return string
     */
    public function getOriginalData()
    {
        return $this->originalData;
    }

    /**
     * Set jsonData
     *
     * @param string jsonData
     */
    public function setJsonData($jsonData)
    {
        $this->jsonData = $jsonData;
    }

    /**
     * Get jsonData
     *
     * @return string
     */
    public function getJsonData()
    {
        return $this->jsonData;
    }

    /**
     * Set jsonNormalizedData
     *
     * @param string jsonNormalizedData
     */
    public function setJsonNormalizedData($jsonNormalizedData)
    {
        $this->jsonNormalizedData = $jsonNormalizedData;
    }

    /**
     * Get jsonNormalizedData
     *
     * @return string
     */
    public function getJsonNormalizedData()
    {
        return $this->jsonNormalizedData;
    }

    /**
     * Set createdAt
     *
     * @param DateTime $createdAt
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->createdAt = $createdAt;
    }

    /**
     * Get createdAt
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->createdAt;
    }

    /**
     * Set updatedAt
     *
     * @param DateTime $updatedAt
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * Get updatedAt
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }

    /**
     * Returns current import progress
     *
     * @return integer
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
