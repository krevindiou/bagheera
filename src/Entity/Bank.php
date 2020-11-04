<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\BankRepository")
 * @ORM\Table(name="bank")
 */
class Bank
{
    /**
     * @var int
     *
     * @ORM\Column(name="bank_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $bankId;

    /**
     * @var Member
     *
     * @ORM\ManyToOne(targetEntity="Member", inversedBy="banks")
     * @ORM\JoinColumn(name="member_id", referencedColumnName="member_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Member")
     * @Assert\Valid()
     */
    protected $member;

    /**
     * @var Provider
     *
     * @ORM\ManyToOne(targetEntity="Provider")
     * @ORM\JoinColumn(name="provider_id", referencedColumnName="provider_id")
     * @Assert\Type(type="App\Entity\Provider")
     * @Assert\Valid()
     */
    protected $provider;

    /**
     * @var string
     *
     * @ORM\Column(name="name", type="string", length=32)
     * @Assert\NotBlank()
     * @Assert\Length(max = 32)
     */
    protected $name;

    /**
     * @var int
     *
     * @ORM\Column(name="sort_order", type="smallint")
     */
    protected $sortOrder = 0;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_favorite", type="boolean", options={"default": true})
     * @Assert\Type("bool")
     */
    protected $favorite = true;

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
     * @var \DateTime
     *
     * @ORM\Column(name="created_at", type="datetime")
     */
    protected $createdAt;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=true)
     */
    protected $updatedAt;

    /**
     * @var Collection
     *
     * @ORM\OneToMany(targetEntity="Account", mappedBy="bank", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"name" = "ASC"})
     */
    protected $accounts;

    public function __construct(Member $member)
    {
        $this->member = $member;
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

    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
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
