<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\AccountRepository")
 * @ORM\Table(
 *  name="account",
 *  indexes={@ORM\Index(name="external_account_id_idx", columns={"external_account_id"})}
 * )
 */
class Account
{
    /**
     * @var int
     *
     * @ORM\Column(name="account_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $accountId;

    /**
     * @var string
     *
     * @ORM\Column(name="external_account_id", type="string", length=32, nullable=true)
     */
    protected $externalAccountId;

    /**
     * @var int
     *
     * @ORM\Column(name="bank_id", type="integer")
     */
    protected $bankId;

    /**
     * @var App\Entity\Bank
     *
     * @ORM\ManyToOne(targetEntity="Bank", inversedBy="accounts")
     * @ORM\JoinColumn(name="bank_id", referencedColumnName="bank_id")
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Bank")
     * @Assert\Valid()
     */
    protected $bank;

    /**
     * @var string
     *
     * @ORM\Column(name="name", type="string", length=64)
     * @Assert\NotBlank()
     * @Assert\Length(max = 64)
     */
    protected $name;

    /**
     * @var string
     *
     * @ORM\Column(name="currency", type="string", length=3)
     * @Assert\NotBlank()
     * @Assert\Currency()
     */
    protected $currency;

    /**
     * @var int
     *
     * @ORM\Column(name="overdraft_facility", type="integer")
     */
    protected $overdraftFacility = 0;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_closed", type="boolean", options={"default": false})
     * @Assert\Type("bool")
     */
    protected $closed = false;
    /**
     * @var bool
     *
     * @ORM\Column(name="is_deleted", type="boolean", options={"default": false})
     * @Assert\Type("bool")
     */
    protected $deleted = false;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="created_at", type="datetime")
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=true)
     */
    protected $updatedAt;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\ManyToMany(targetEntity="Member")
     * @ORM\JoinTable(name="shared_account",
     *   joinColumns={
     *     @ORM\JoinColumn(name="account_id", referencedColumnName="account_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="member_id", referencedColumnName="member_id")
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

    public function __toString(): string
    {
        return $this->getBank()->getName().' - '.$this->getName();
    }

    public function getAccountId(): ?int
    {
        return $this->accountId;
    }

    public function setExternalAccountId(string $externalAccountId): void
    {
        $this->externalAccountId = $externalAccountId;
    }

    public function getExternalAccountId(): ?string
    {
        return $this->externalAccountId;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setCurrency(string $currency): void
    {
        $this->currency = $currency;
    }

    public function getCurrency(): ?string
    {
        return $this->currency;
    }

    public function setOverdraftFacility(int $overdraftFacility): void
    {
        $this->overdraftFacility = $overdraftFacility;
    }

    public function getOverdraftFacility(): ?int
    {
        return $this->overdraftFacility;
    }

    public function setClosed(bool $closed): void
    {
        $this->closed = $closed;
    }

    public function isClosed(): ?bool
    {
        return $this->closed;
    }

    public function setDeleted(bool $deleted): void
    {
        $this->deleted = $deleted;
    }

    public function isDeleted(): ?bool
    {
        return $this->deleted;
    }

    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }

    public function addSharedWith(Member $member): void
    {
        $this->sharedWith[] = $member;
    }

    public function getSharedWith(): Collection
    {
        return $this->sharedWith;
    }

    public function setBank(Bank $bank): void
    {
        $this->bank = $bank;
    }

    public function getBank(): ?Bank
    {
        return $this->bank;
    }

    public function getOperations(): Collection
    {
        return $this->operations;
    }

    public function getSchedulers(): Collection
    {
        return $this->schedulers;
    }

    public function isManual(): ?bool
    {
        return $this->getBank()->isManual();
    }

    public function isOwner(Member $member): ?bool
    {
        return $this->getBank()->getMember()->getMemberId() === $member->getMemberId();
    }
}
