<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM,
    Doctrine\Common\Collections\ArrayCollection,
    Symfony\Component\Validator\Constraints as Assert;

/**
 * Krevindiou\BagheeraBundle\Entity\Category
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="category")
 * @ORM\HasLifecycleCallbacks()
 */
class Category
{
    /**
     * @var integer $categoryId
     *
     * @ORM\Column(name="category_id", type="smallint", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $categoryId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Category $parentCategory
     *
     * @ORM\ManyToOne(targetEntity="Category", inversedBy="subCategories")
     * @ORM\JoinColumn(name="parent_category_id", referencedColumnName="category_id")
     * @Assert\Valid()
     */
    protected $parentCategory;

    /**
     * @var string $type
     *
     * @ORM\Column(name="type", type="string", length=8, nullable=true)
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"debit", "credit"})
     */
    protected $type;

    /**
     * @var string $name
     *
     * @ORM\Column(name="name", type="string", length=32, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Length(max = 32)
     */
    protected $name;

    /**
     * @var boolean $isActive
     *
     * @ORM\Column(name="is_active", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $isActive = true;

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
     * @var Doctrine\Common\Collections\Collection $subCategories
     *
     * @ORM\OneToMany(targetEntity="Category", mappedBy="parentCategory", fetch="EXTRA_LAZY")
     */
    protected $subCategories;

    public function __construct()
    {
        $this->subCategories = new ArrayCollection();
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
     * Get categoryId
     *
     * @return smallint
     */
    public function getCategoryId()
    {
        return $this->categoryId;
    }

    /**
     * Set type
     *
     * @param string $type
     */
    public function setType($type)
    {
        $this->type = $type;
    }

    /**
     * Get type
     *
     * @return string
     */
    public function getType()
    {
        return $this->type;
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
     * Set isActive
     *
     * @param boolean $isActive
     */
    public function setIsActive($isActive)
    {
        $this->isActive = (bool) $isActive;
    }

    /**
     * Get isActive
     *
     * @return boolean
     */
    public function getIsActive()
    {
        return $this->isActive;
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
     * Set parentCategory
     *
     * @param Krevindiou\BagheeraBundle\Entity\Category $parentCategory
     */
    public function setParentCategory(Category $parentCategory)
    {
        $this->parentCategory = $parentCategory;
    }

    /**
     * Get parentCategory
     *
     * @return Krevindiou\BagheeraBundle\Entity\Category
     */
    public function getParentCategory()
    {
        return $this->parentCategory;
    }

    /**
     * Get subCategories
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getSubCategories()
    {
        return $this->subCategories;
    }

    public function __toString()
    {
        $str = $this->getName();

        $parentCategory = $this->getParentCategory();
        if (null !== $parentCategory) {
            $str = $parentCategory->getName() . ' > ' . $str;
        }

        return $str;
    }
}
