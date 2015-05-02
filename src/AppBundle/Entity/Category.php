<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity
 * @ORM\Table(name="category")
 */
class Category
{
    /**
     * @var int
     *
     * @ORM\Column(name="category_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $categoryId;

    /**
     * @var AppBundle\Entity\Category
     *
     * @ORM\ManyToOne(targetEntity="Category", inversedBy="subCategories")
     * @ORM\JoinColumn(name="parent_category_id", referencedColumnName="category_id")
     * @Assert\Type(type="AppBundle\Entity\Category")
     * @Assert\Valid()
     */
    protected $parentCategory;

    /**
     * @var string
     *
     * @ORM\Column(name="type", type="string", length=8, nullable=true)
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"debit", "credit"})
     */
    protected $type;

    /**
     * @var string
     *
     * @ORM\Column(name="name", type="string", length=32, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Length(max = 32)
     */
    protected $name;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_active", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $active = true;

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
     * @ORM\OneToMany(targetEntity="Category", mappedBy="parentCategory", fetch="EXTRA_LAZY")
     */
    protected $subCategories;

    public function __construct()
    {
        $this->subCategories = new ArrayCollection();
    }

    /**
     * Get categoryId.
     *
     * @return smallint
     */
    public function getCategoryId()
    {
        return $this->categoryId;
    }

    /**
     * Set type.
     *
     * @param string $type
     */
    public function setType($type)
    {
        $this->type = $type;
    }

    /**
     * Get type.
     *
     * @return string
     */
    public function getType()
    {
        return $this->type;
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
     * Set active.
     *
     * @param bool $active
     */
    public function setActive($active)
    {
        $this->active = (bool) $active;
    }

    /**
     * Get active.
     *
     * @return bool
     */
    public function isActive()
    {
        return $this->active;
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
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }

    /**
     * Set parentCategory.
     *
     * @param AppBundle\Entity\Category $parentCategory
     */
    public function setParentCategory(Category $parentCategory)
    {
        $this->parentCategory = $parentCategory;
    }

    /**
     * Get parentCategory.
     *
     * @return AppBundle\Entity\Category
     */
    public function getParentCategory()
    {
        return $this->parentCategory;
    }

    /**
     * Get subCategories.
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
            $str = $parentCategory->getName().' > '.$str;
        }

        return $str;
    }
}
