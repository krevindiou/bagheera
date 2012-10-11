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
 * @ORM\Entity(repositoryClass="Krevindiou\BagheeraBundle\Repository\AccountRepository")
 * @ORM\Table(
 *  name="account",
 *  indexes={@ORM\Index(name="external_account_id_idx", columns={"external_account_id"})}
 * )
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
     * @var string $externalAccountId
     *
     * @ORM\Column(name="external_account_id", type="string", length=32, nullable=true)
     */
    protected $externalAccountId;

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
     * @ORM\JoinColumn(name="bank_id", referencedColumnName="bank_id")
     * @Assert\NotBlank()
     * @Assert\Valid()
     */
    protected $bank;

    /**
     * @var string $name
     *
     * @ORM\Column(name="name", type="string", length=32, nullable=false)
     * @Assert\NotBlank()
     * @Assert\MaxLength(32)
     */
    protected $name;

    /**
     * @var string $currency
     *
     * @ORM\Column(name="currency", type="string", length=3, nullable=false)
     * @Assert\NotBlank()
     * @Assert\MaxLength(3)
     */
    protected $currency;

    /**
     * @var float $initialBalance
     *
     * @ORM\Column(name="initial_balance", type="decimal", scale="2", nullable=false)
     */
    protected $initialBalance = 0;

    /**
     * @var float $overdraftFacility
     *
     * @ORM\Column(name="overdraft_facility", type="decimal", scale="2", nullable=false)
     */
    protected $overdraftFacility = 0;

    /**
     * @var string $iban
     *
     * @ORM\Column(name="iban", type="string", length=34, nullable=true)
     * @Assert\MaxLength(34)
     */
    protected $iban;

    /**
     * @var string $bic
     *
     * @ORM\Column(name="bic", type="string", length=11, nullable=true)
     * @Assert\MaxLength(11)
     */
    protected $bic;

    /**
     * @var boolean $isDeleted
     *
     * @ORM\Column(name="is_deleted", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $isDeleted = false;

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
     * @var Doctrine\Common\Collections\Collection $sharedWith
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
     * @ORM\OrderBy({"email" = "ASC"})
     */
    protected $sharedWith;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\OneToMany(targetEntity="Operation", mappedBy="account", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"valueDate" = "DESC"})
     */
    protected $operations;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\OneToMany(targetEntity="Scheduler", mappedBy="account", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"valueDate" = "DESC"})
     */
    protected $schedulers;


    public function __construct()
    {
        $this->sharedWith = new ArrayCollection();
        $this->operations = new ArrayCollection();
        $this->schedulers = new ArrayCollection();
    }

    /**
     * @ORM\PrePersist
     */
    public function prePersist()
    {
        $this->setInitialBalance((float)$this->getInitialBalance());
        $this->setOverdraftFacility((float)$this->getOverdraftFacility());
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\PreUpdate
     */
    public function preUpdate()
    {
        $this->setInitialBalance((float)$this->getInitialBalance());
        $this->setOverdraftFacility((float)$this->getOverdraftFacility());
        $this->setUpdatedAt(new \DateTime());
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
     * Set externalAccountId
     *
     * @param string $externalAccountId
     */
    public function setExternalAccountId($externalAccountId)
    {
        $this->externalAccountId = $externalAccountId;
    }

    /**
     * Get externalAccountId
     *
     * @return string
     */
    public function getExternalAccountId()
    {
        return $this->externalAccountId;
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
     * Set currency
     *
     * @param string $currency
     */
    public function setCurrency($currency)
    {
        $this->currency = $currency;
    }

    /**
     * Get currency
     *
     * @return string
     */
    public function getCurrency()
    {
        return $this->currency;
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
     * Set iban
     *
     * @param string $iban
     */
    public function setIban($iban)
    {
        $this->iban = $iban;
    }

    /**
     * Get iban
     *
     * @return string
     */
    public function getIban()
    {
        return $this->iban;
    }

    /**
     * Set bic
     *
     * @param string $bic
     */
    public function setBic($bic)
    {
        $this->bic = $bic;
    }

    /**
     * Get bic
     *
     * @return string
     */
    public function getBic()
    {
        return $this->bic;
    }

    /**
     * Set isDeleted
     *
     * @param boolean $isDeleted
     */
    public function setIsDeleted($isDeleted)
    {
        $this->isDeleted = (bool)$isDeleted;
    }

    /**
     * Get isDeleted
     *
     * @return boolean
     */
    public function isDeleted()
    {
        return $this->isDeleted;
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
     * @return Doctrine\Common\Collections\Collection
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
     * @return Doctrine\Common\Collections\Collection
     */
    public function getOperations()
    {
        return $this->operations;
    }

    /**
     * Get account schedulers
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getSchedulers()
    {
        return $this->schedulers;
    }

    public function isManual()
    {
        return $this->getBank()->isManual();
    }

    public function __toString()
    {
        return $this->getName();
    }
}
