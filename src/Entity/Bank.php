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
     * @ORM\Column(name="bank_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $bankId;

    /**
     * @var App\Entity\Member
     *
     * @ORM\ManyToOne(targetEntity="Member", inversedBy="banks")
     * @ORM\JoinColumn(name="member_id", referencedColumnName="member_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Member")
     * @Assert\Valid()
     */
    protected $member;

    /**
     * @var App\Entity\Provider
     *
     * @ORM\ManyToOne(targetEntity="Provider")
     * @ORM\JoinColumn(name="provider_id", referencedColumnName="provider_id", nullable=true)
     * @Assert\Type(type="App\Entity\Provider")
     * @Assert\Valid()
     */
    protected $provider;

    /**
     * @var string
     *
     * @ORM\Column(name="name", type="string", length=32, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Length(max = 32)
     */
    protected $name;

    /**
     * @var int
     *
     * @ORM\Column(name="sort_order", type="smallint", nullable=false)
     */
    protected $sortOrder = 0;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_favorite", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $favorite = true;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_closed", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $closed = false;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_deleted", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $deleted = false;

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
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\OneToMany(targetEntity="Account", mappedBy="bank", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"name" = "ASC"})
     */
    protected $accounts;

    public function __construct()
    {
        $this->accounts = new ArrayCollection();
    }

    public function __toString(): string
    {
        return $this->getName();
    }

    /**
     * Get bankId.
     *
     * @return int
     */
    public function getBankId(): ?int
    {
        return $this->bankId;
    }

    /**
     * Set member.
     *
     * @param App\Entity\Member $member
     */
    public function setMember(Member $member): void
    {
        $this->member = $member;
    }

    /**
     * Get member.
     *
     * @return App\Entity\Member
     */
    public function getMember(): ?Member
    {
        return $this->member;
    }

    /**
     * Set provider.
     *
     * @param App\Entity\Provider $provider
     */
    public function setProvider(?Provider $provider): void
    {
        $this->provider = $provider;
    }

    /**
     * Get provider.
     *
     * @return Provider
     */
    public function getProvider(): ?Provider
    {
        return $this->provider;
    }

    /**
     * Set name.
     *
     * @param string $name
     */
    public function setName(string $name): void
    {
        $this->name = $name;
    }

    /**
     * Get name.
     *
     * @return string
     */
    public function getName(): ?string
    {
        return $this->name;
    }

    /**
     * Set sortOrder.
     *
     * @param int $sortOrder
     */
    public function setSortOrder(int $sortOrder): void
    {
        $this->sortOrder = $sortOrder;
    }

    /**
     * Get sortOrder.
     *
     * @return int
     */
    public function getSortOrder(): ?int
    {
        return $this->sortOrder;
    }

    /**
     * Set favorite.
     *
     * @param bool $favorite
     */
    public function setFavorite(bool $favorite): void
    {
        $this->favorite = $favorite;
    }

    /**
     * Get favorite.
     *
     * @return bool
     */
    public function isFavorite(): ?bool
    {
        return $this->favorite;
    }

    /**
     * Set closed.
     *
     * @param bool $closed
     */
    public function setClosed(bool $closed): void
    {
        $this->closed = $closed;
    }

    /**
     * Get closed.
     *
     * @return bool
     */
    public function isClosed(): ?bool
    {
        return $this->closed;
    }

    /**
     * Set deleted.
     *
     * @param bool $deleted
     */
    public function setDeleted(bool $deleted): void
    {
        $this->deleted = $deleted;
    }

    /**
     * Get deleted.
     *
     * @return bool
     */
    public function isDeleted(): ?bool
    {
        return $this->deleted;
    }

    public function isActive(): bool
    {
        return !$this->isDeleted() && !$this->isClosed();
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
     * Get member accounts.
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getAccounts(): Collection
    {
        return $this->accounts;
    }

    public function isManual(): bool
    {
        return null === $this->getProvider();
    }
}
