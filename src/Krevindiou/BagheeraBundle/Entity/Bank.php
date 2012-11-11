<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM,
    Doctrine\Common\Collections\ArrayCollection,
    Symfony\Component\Validator\Constraints as Assert;

/**
 * Krevindiou\BagheeraBundle\Entity\Bank
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="bank")
 * @ORM\HasLifecycleCallbacks()
 */
class Bank
{
    /**
     * @var integer $bankId
     *
     * @ORM\Column(name="bank_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $bankId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\User $user
     *
     * @ORM\ManyToOne(targetEntity="User", inversedBy="banks")
     * @ORM\JoinColumn(name="user_id", referencedColumnName="user_id", nullable=false)
     * @Assert\NotBlank()
     * @Assert\Valid()
     */
    protected $user;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Provider $provider
     *
     * @ORM\ManyToOne(targetEntity="Provider")
     * @ORM\JoinColumn(name="provider_id", referencedColumnName="provider_id", nullable=true)
     * @Assert\Valid()
     */
    protected $provider;

    /**
     * @var string $name
     *
     * @ORM\Column(name="name", type="string", length=32, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Length(max = 32)
     */
    protected $name;

    /**
     * @var integer $sortOrder
     *
     * @ORM\Column(name="sort_order", type="smallint", nullable=false)
     */
    protected $sortOrder;

    /**
     * @var boolean $isFavorite
     *
     * @ORM\Column(name="is_favorite", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $isFavorite = true;

    /**
     * @var boolean $isClosed
     *
     * @ORM\Column(name="is_closed", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $isClosed = false;

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
     * @var Doctrine\Common\Collections\Collection $accounts
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
     * Get bankId
     *
     * @return integer
     */
    public function getBankId()
    {
        return $this->bankId;
    }

    /**
     * Set user
     *
     * @param Krevindiou\BagheeraBundle\Entity\User $user
     */
    public function setUser(User $user)
    {
        $this->user = $user;
    }

    /**
     * Get user
     *
     * @return Krevindiou\BagheeraBundle\Entity\User
     */
    public function getUser()
    {
        return $this->user;
    }

    /**
     * Set provider
     *
     * @param Krevindiou\BagheeraBundle\Entity\Provider $provider
     */
    public function setProvider(Provider $provider)
    {
        $this->provider = $provider;
    }

    /**
     * Get provider
     *
     * @return Provider
     */
    public function getProvider()
    {
        return $this->provider;
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
     * Set sortOrder
     *
     * @param integer $sortOrder
     */
    public function setSortOrder($sortOrder)
    {
        $this->sortOrder = $sortOrder;
    }

    /**
     * Get sortOrder
     *
     * @return integer
     */
    public function getSortOrder()
    {
        return $this->sortOrder;
    }

    /**
     * Set isFavorite
     *
     * @param boolean $isFavorite
     */
    public function setIsFavorite($isFavorite)
    {
        $this->isFavorite = (bool) $isFavorite;
    }

    /**
     * Get isFavorite
     *
     * @return boolean
     */
    public function isFavorite()
    {
        return $this->isFavorite;
    }

    /**
     * Set isClosed
     *
     * @param boolean $isClosed
     */
    public function setIsClosed($isClosed)
    {
        $this->isClosed = (bool) $isClosed;
    }

    /**
     * Get isClosed
     *
     * @return boolean
     */
    public function isClosed()
    {
        return $this->isClosed;
    }

    /**
     * Set isDeleted
     *
     * @param boolean $isDeleted
     */
    public function setIsDeleted($isDeleted)
    {
        $this->isDeleted = (bool) $isDeleted;
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
     * Get user accounts
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
