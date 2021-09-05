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
    use TimestampableTrait;

    /**
     *
     * @ORM\Column(name="account_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected ?int $accountId = null;

    /**
     * @ORM\Column(name="external_account_id", type="string", length=32, nullable=true)
     */
    protected ?string $externalAccountId = null;

    /**
     * @ORM\Column(name="bank_id", type="integer")
     */
    protected int $bankId;

    /**
     *
     * @ORM\ManyToOne(targetEntity="Bank", inversedBy="accounts")
     * @ORM\JoinColumn(name="bank_id", referencedColumnName="bank_id")
     */
    #[Assert\NotNull]
    #[Assert\Type(type: 'App\Entity\Bank')]
    #[Assert\Valid]
    protected ?Bank $bank = null;

    /**
     * @ORM\Column(name="name", type="string", length=64)
     */
    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    protected ?string $name = null;

    /**
     * @ORM\Column(name="currency", type="string", length=3)
     */
    #[Assert\NotBlank]
    #[Assert\Currency]
    protected ?string $currency = null;

    /**
     * @ORM\Column(name="overdraft_facility", type="integer")
     */
    protected ?int $overdraftFacility = 0;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_closed", type="boolean", options={"default": false})
     */
    #[Assert\Type(type: 'bool')]
    protected $closed = false;
    /**
     * @var bool
     *
     * @ORM\Column(name="is_deleted", type="boolean", options={"default": false})
     */
    #[Assert\Type(type: 'bool')]
    protected $deleted = false;

    /**
     * @var Collection
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
    protected array|Collection|ArrayCollection $sharedWith;

    /**
     * @var Collection
     *
     * @ORM\OneToMany(targetEntity="Operation", mappedBy="account", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"valueDate" = "DESC"})
     */
    protected array|Collection|ArrayCollection $operations;

    /**
     * @var Collection
     *
     * @ORM\OneToMany(targetEntity="Scheduler", mappedBy="account", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"valueDate" = "DESC"})
     */
    protected array|Collection|ArrayCollection $schedulers;

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
