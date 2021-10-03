<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\Index;
use Doctrine\ORM\Mapping\InverseJoinColumn;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\JoinTable;
use Doctrine\ORM\Mapping\ManyToMany;
use Doctrine\ORM\Mapping\ManyToOne;
use Doctrine\ORM\Mapping\OneToMany;
use Doctrine\ORM\Mapping\OrderBy;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'account')]
#[Index(name: 'external_account_id_idx', columns: ['external_account_id'])]
class Account
{
    use TimestampableTrait;

    #[Id, Column(name: 'account_id', type: 'integer')]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $accountId = null;

    #[Column(name: 'external_account_id', type: 'string', length: 32, nullable: true)]
    private ?string $externalAccountId = null;

    #[Column(name: 'bank_id', type: 'integer')]
    private int $bankId;

    #[Assert\NotNull]
    #[Assert\Type(type: Bank::class)]
    #[Assert\Valid]
    #[ManyToOne(targetEntity: Bank::class, inversedBy: 'accounts')]
    #[JoinColumn(name: 'bank_id', referencedColumnName: 'bank_id')]
    private ?Bank $bank = null;

    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    #[Column(name: 'name', type: 'string', length: 64)]
    private ?string $name = null;

    #[Assert\NotBlank]
    #[Assert\Currency]
    #[Column(name: 'currency', type: 'string', length: 3)]
    private ?string $currency = null;

    #[Column(name: 'overdraft_facility', type: 'integer')]
    private ?int $overdraftFacility = 0;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_closed', type: 'boolean', options: ['default' => false])]
    private ?bool $closed = false;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_deleted', type: 'boolean', options: ['default' => false])]
    private ?bool $deleted = false;

    #[ManyToMany(targetEntity: Member::class)]
    #[JoinTable(name: 'shared_account')]
    #[JoinColumn(name: 'account_id', referencedColumnName: 'account_id')]
    #[InverseJoinColumn(name: 'member_id', referencedColumnName: 'member_id')]
    #[OrderBy(value: ['email' => 'ASC'])]
    private Collection $sharedWith;

    #[OneToMany(targetEntity: Operation::class, mappedBy: 'account', cascade: ['all'], fetch: 'EXTRA_LAZY')]
    #[OrderBy(value: ['valueDate' => 'DESC'])]
    private Collection $operations;

    #[OneToMany(targetEntity: Scheduler::class, mappedBy: 'account', cascade: ['all'], fetch: 'EXTRA_LAZY')]
    #[OrderBy(value: ['valueDate' => 'DESC'])]
    private Collection $schedulers;

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

    public function setAccountId(int $accountId): void
    {
        $this->accountId = $accountId;
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
