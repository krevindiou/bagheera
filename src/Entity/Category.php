<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\CategoryRepository")
 * @ORM\Table(name="category")
 */
class Category
{
    use TimestampableTrait;

    /**
     *
     * @ORM\Column(name="category_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected ?int $categoryId = null;

    /**
     * @var Category
     *
     * @ORM\ManyToOne(targetEntity="Category", inversedBy="subCategories")
     * @ORM\JoinColumn(name="parent_category_id", referencedColumnName="category_id")
     */
    #[Assert\Type(type: 'App\Entity\Category')]
    #[Assert\Valid]
    protected $parentCategory;

    /**
     * @ORM\Column(name="type", type="string", length=8)
     */
    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['debit', 'credit'])]
    protected ?string $type = null;

    /**
     * @ORM\Column(name="name", type="string", length=32)
     */
    #[Assert\NotBlank]
    #[Assert\Length(max: 32)]
    protected ?string $name = null;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_active", type="boolean", options={"default": true})
     */
    #[Assert\Type(type: 'bool')]
    protected $active = true;

    /**
     * @var Collection
     *
     * @ORM\OneToMany(targetEntity="Category", mappedBy="parentCategory", fetch="EXTRA_LAZY")
     */
    protected array|Collection|ArrayCollection $subCategories;

    public function __construct()
    {
        $this->subCategories = new ArrayCollection();
    }

    public function __toString(): string
    {
        $str = $this->getName();

        $parentCategory = $this->getParentCategory();
        if (null !== $parentCategory) {
            $str = $parentCategory->getName().' > '.$str;
        }

        return $str;
    }

    public function getCategoryId(): ?int
    {
        return $this->categoryId;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setActive(bool $active): void
    {
        $this->active = $active;
    }

    public function isActive(): ?bool
    {
        return $this->active;
    }

    public function setParentCategory(self $parentCategory): void
    {
        $this->parentCategory = $parentCategory;
    }

    public function getParentCategory(): ?self
    {
        return $this->parentCategory;
    }

    public function getSubCategories(): Collection
    {
        return $this->subCategories;
    }
}
