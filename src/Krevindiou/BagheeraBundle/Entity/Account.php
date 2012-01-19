<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM,
    Doctrine\Common\Collections\ArrayCollection,
    Symfony\Component\Validator\Constraints as Assert;

/**
 * Krevindiou\BagheeraBundle\Entity\Account
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="account")
 * @ORM\HasLifecycleCallbacks()
 */
class Account
{
    /**
     * @var integer $accountId
     *
     * @ORM\Column(name="account_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $accountId;

    /**
     * @var string $name
     *
     * @ORM\Column(name="name", type="string", length=32, nullable=false)
     * @Assert\NotBlank()
     * @Assert\MaxLength(32)
     */
    protected $name;

    /**
     * @var float $initialBalance
     *
     * @ORM\Column(name="initial_balance", type="decimal", nullable=false)
     */
    protected $initialBalance;

    /**
     * @var float $overdraftFacility
     *
     * @ORM\Column(name="overdraft_facility", type="decimal", nullable=true)
     */
    protected $overdraftFacility;

    /**
     * @var string $details
     *
     * @ORM\Column(name="details", type="string", length=64, nullable=true)
     * @Assert\MaxLength(64)
     */
    protected $details;

    /**
     * @Assert\File(
     *     maxSize = "10M",
     *     mimeTypes = {
     *         "application/pdf",
     *         "application/x-pdf",
     *         "image/pjpeg",
     *         "image/jpeg",
     *         "image/gif",
     *         "image/png",
     *         "image/x-png"
     *     }
     * )
     */
    protected $detailsFile;

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
     * @var Doctrine\Common\Collections\ArrayCollection $sharedWith
     *
     * @ORM\ManyToMany(targetEntity="User")
     * @ORM\JoinTable(name="shared_account",
     *   joinColumns={
     *     @ORM\JoinColumn(name="account_id", referencedColumnName="account_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="user_id", referencedColumnName="user_id")
     *   }
     * )
     * @ORM\OrderBy({"lastname" = "ASC"})
     */
    protected $sharedWith;

    /**
     * @var integer $bankId
     *
     * @ORM\Column(name="bank_id", type="integer", nullable=false)
     */
    protected $bankId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Bank $bank
     *
     * @ORM\ManyToOne(targetEntity="Bank", inversedBy="accounts")
     * @ORM\JoinColumns({
     *   @ORM\JoinColumn(name="bank_id", referencedColumnName="bank_id")
     * })
     * @Assert\NotBlank()
     * @Assert\Valid()
     */
    protected $bank;

    /**
     * @var Doctrine\Common\Collections\ArrayCollection
     *
     * @ORM\OneToMany(targetEntity="Operation", mappedBy="account", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"valueDate" = "DESC"})
     */
    protected $operations;

    /**
     * @var Doctrine\Common\Collections\ArrayCollection
     *
     * @ORM\OneToMany(targetEntity="Scheduler", mappedBy="account", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"valueDate" = "DESC"})
     */
    protected $schedulers;


    public function __construct()
    {
        $this->setInitialBalance(0);
        $this->setOverdraftFacility(0);
        $this->sharedWith = new ArrayCollection();
        $this->operations = new ArrayCollection();
        $this->schedulers = new ArrayCollection();
    }

    /**
     * @ORM\prePersist
     */
    public function prePersist()
    {
        $this->setInitialBalance((float)$this->getInitialBalance());
        $this->setOverdraftFacility((float)$this->getOverdraftFacility());
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\preUpdate
     */
    public function preUpdate()
    {
        $this->setInitialBalance((float)$this->getInitialBalance());
        $this->setOverdraftFacility((float)$this->getOverdraftFacility());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\PrePersist()
     * @ORM\PreUpdate()
     */
    public function preUpload()
    {
        if (null !== $this->detailsFile) {
            $this->details = uniqid() . '.' . $this->detailsFile->guessExtension();
        }
    }

    /**
     * @ORM\PostPersist()
     * @ORM\PostUpdate()
     */
    public function upload()
    {
        if (null === $this->detailsFile) {
            return;
        }

        $this->detailsFile->move($this->getUploadRootDir(), $this->details);

        unset($this->detailsFile);
    }

    /**
     * @ORM\PostRemove()
     */
    public function removeUpload()
    {
        if (($file = $this->getAbsolutePath()) && is_file($file)) {
            unlink($file);
        }
    }

    /**
     * Get accountId
     *
     * @return integer
     */
    public function getAccountId()
    {
        return $this->accountId;
    }

    /**
     * Set name
     *
     * @param string $name
     */
    public function setName($name)
    {
        $this->name = $name;
    }

    /**
     * Get name
     *
     * @return string
     */
    public function getName()
    {
        return $this->name;
    }

    /**
     * Set initialBalance
     *
     * @param float $initialBalance
     */
    public function setInitialBalance($initialBalance)
    {
        $this->initialBalance = $initialBalance;
    }

    /**
     * Get initialBalance
     *
     * @return float
     */
    public function getInitialBalance()
    {
        return $this->initialBalance;
    }

    /**
     * Set overdraftFacility
     *
     * @param float $overdraftFacility
     */
    public function setOverdraftFacility($overdraftFacility)
    {
        $this->overdraftFacility = $overdraftFacility;
    }

    /**
     * Get overdraftFacility
     *
     * @return float
     */
    public function getOverdraftFacility()
    {
        return $this->overdraftFacility;
    }

    /**
     * Set details
     *
     * @param string $details
     */
    public function setDetails($details)
    {
        $this->details = $details;
    }

    /**
     * Get details
     *
     * @return string
     */
    public function getDetails()
    {
        return $this->details;
    }

    /**
     * Set detailsFile
     *
     * @param string $detailsFile
     */
    public function setDetailsFile($detailsFile)
    {
        $this->detailsFile = $detailsFile;
    }

    /**
     * Get detailsFile
     *
     * @return string
     */
    public function getDetailsFile()
    {
        return $this->detailsFile;
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
     * Add user
     *
     * @param Krevindiou\BagheeraBundle\Entity\User $user
     */
    public function addSharedWith(User $user)
    {
        $this->sharedWith[] = $user;
    }

    /**
     * Get sharedWith
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getSharedWith()
    {
        return $this->sharedWith;
    }

    /**
     * Set bank
     *
     * @param Krevindiou\BagheeraBundle\Entity\Bank $bank
     */
    public function setBank(Bank $bank)
    {
        $this->bank = $bank;
    }

    /**
     * Get bank
     *
     * @return Krevindiou\BagheeraBundle\Entity\Bank
     */
    public function getBank()
    {
        return $this->bank;
    }

    /**
     * Get account operations
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getOperations()
    {
        return $this->operations;
    }

    /**
     * Get account schedulers
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getSchedulers()
    {
        return $this->schedulers;
    }

    public function __toString()
    {
        return $this->getName();
    }

    public function getAbsolutePath()
    {
        return '' == $this->details ? null : $this->getUploadRootDir() . '/' . $this->details;
    }

    protected function getUploadRootDir()
    {
        return __DIR__ . '/../Resources/upload/BankDetails';
    }
}
