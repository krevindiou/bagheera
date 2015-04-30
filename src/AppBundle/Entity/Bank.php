<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Component\Validator\Constraints as Assert;
use Gedmo\Mapping\Annotation as Gedmo;

/**
 * @ORM\Entity(repositoryClass="AppBundle\Repository\BankRepository")
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
     * @var AppBundle\Entity\Member
     *
     * @ORM\ManyToOne(targetEntity="Member", inversedBy="banks")
     * @ORM\JoinColumn(name="member_id", referencedColumnName="member_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="AppBundle\Entity\Member")
     * @Assert\Valid()
     */
    protected $member;

    /**
     * @var AppBundle\Entity\Provider
     *
     * @ORM\ManyToOne(targetEntity="Provider")
     * @ORM\JoinColumn(name="provider_id", referencedColumnName="provider_id", nullable=true)
     * @Assert\Type(type="AppBundle\Entity\Provider")
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
     * @Gedmo\Timestampable(on="create")
     * @Assert\DateTime()
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     * @Gedmo\Timestampable(on="update")
     * @Assert\DateTime()
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

    /**
     * Get bankId.
     *
     * @return int
     */
    public function getBankId()
    {
        return $this->bankId;
    }

    /**
     * Set member.
     *
     * @param AppBundle\Entity\Member $member
     */
    public function setMember(Member $member)
    {
        $this->member = $member;
    }

    /**
     * Get member.
     *
     * @return AppBundle\Entity\Member
     */
    public function getMember()
    {
        return $this->member;
    }

    /**
     * Set provider.
     *
     * @param AppBundle\Entity\Provider $provider
     */
    public function setProvider(Provider $provider = null)
    {
        $this->provider = $provider;
    }

    /**
     * Get provider.
     *
     * @return Provider
     */
    public function getProvider()
    {
        return $this->provider;
    }

    /**
     * Set name.
     *
     * @param string $name
     */
    public function setName($name)
    {
        $this->name = $name;
    }

    /**
     * Get name.
     *
     * @return string
     */
    public function getName()
    {
        return $this->name;
    }

    /**
     * Set sortOrder.
     *
     * @param int $sortOrder
     */
    public function setSortOrder($sortOrder)
    {
        $this->sortOrder = $sortOrder;
    }

    /**
     * Get sortOrder.
     *
     * @return int
     */
    public function getSortOrder()
    {
        return $this->sortOrder;
    }

    /**
     * Set favorite.
     *
     * @param bool $favorite
     */
    public function setFavorite($favorite)
    {
        $this->favorite = (bool) $favorite;
    }

    /**
     * Get favorite.
     *
     * @return bool
     */
    public function isFavorite()
    {
        return $this->favorite;
    }

    /**
     * Set closed.
     *
     * @param bool $closed
     */
    public function setClosed($closed)
    {
        $this->closed = (bool) $closed;
    }

    /**
     * Get closed.
     *
     * @return bool
     */
    public function isClosed()
    {
        return $this->closed;
    }

    /**
     * Set deleted.
     *
     * @param bool $deleted
     */
    public function setDeleted($deleted)
    {
        $this->deleted = (bool) $deleted;
    }

    /**
     * Get deleted.
     *
     * @return bool
     */
    public function isDeleted()
    {
        return $this->deleted;
    }

    public function isActive()
    {
        return !$this->isDeleted() && !$this->isClosed();
    }

    /**
     * Set createdAt.
     *
     * @param DateTime $createdAt
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->createdAt = $createdAt;
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
     * Set updatedAt.
     *
     * @param DateTime $updatedAt
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->updatedAt = $updatedAt;
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
     * Get member accounts.
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getAccounts()
    {
        return $this->accounts;
    }

    public function isManual()
    {
        return null === $this->getProvider();
    }

    public function __toString()
    {
        return $this->getName();
    }
}
