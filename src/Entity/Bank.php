<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\ManyToOne;
use Doctrine\ORM\Mapping\OneToMany;
use Doctrine\ORM\Mapping\OrderBy;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'bank')]
class Bank
{
    use TimestampableTrait;

    #[Id, Column(name: 'bank_id', type: 'integer')]
    #[GeneratedValue(strategy: 'IDENTITY')]
    protected ?int $bankId = null;

    #[Assert\Type(type: Provider::class)]
    #[ManyToOne(targetEntity: Provider::class)]
    #[JoinColumn(name: 'provider_id', referencedColumnName: 'provider_id')]
    protected ?Provider $provider = null;

    #[Assert\NotBlank]
    #[Assert\Length(max: 32)]
    #[Column(name: 'name', type: 'string', length: 32)]
    protected ?string $name = null;

    #[Column(name: 'sort_order', type: 'smallint')]
    protected ?int $sortOrder = 0;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_favorite', type: 'boolean', options: ['default' => true])]
    protected ?bool $favorite = true;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_closed', type: 'boolean', options: ['default' => false])]
    protected ?bool $closed = false;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_deleted', type: 'boolean', options: ['default' => false])]
    protected ?bool $deleted = false;

    #[OneToMany(targetEntity: Account::class, mappedBy: 'bank', cascade: ['all'], fetch: 'EXTRA_LAZY')]
    #[OrderBy(value: ['name' => 'ASC'])]
    protected Collection $accounts;

    public function __construct(
        #[Assert\NotNull]
        #[Assert\Type(type: Member::class)]
        #[ManyToOne(targetEntity: Member::class, inversedBy: 'banks')]
        #[JoinColumn(name: 'member_id', referencedColumnName: 'member_id', nullable: false)]
        protected ?Member $member
    ) {
        $this->accounts = new ArrayCollection();
    }

    public function __toString(): string
    {
        return $this->getName();
    }

    public function getBankId(): ?int
    {
        return $this->bankId;
    }

    public function setMember(Member $member): void
    {
        $this->member = $member;
    }

    public function getMember(): ?Member
    {
        return $this->member;
    }

    public function setProvider(?Provider $provider): void
    {
        $this->provider = $provider;
    }

    public function getProvider(): ?Provider
    {
        return $this->provider;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setSortOrder(int $sortOrder): void
    {
        $this->sortOrder = $sortOrder;
    }

    public function getSortOrder(): ?int
    {
        return $this->sortOrder;
    }

    public function setFavorite(bool $favorite): void
    {
        $this->favorite = $favorite;
    }

    public function isFavorite(): ?bool
    {
        return $this->favorite;
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

    public function isActive(): bool
    {
        return !$this->isDeleted() && !$this->isClosed();
    }

    public function getAccounts(): Collection
    {
        return $this->accounts;
    }

    public function isManual(): bool
    {
        return null === $this->getProvider();
    }
}
