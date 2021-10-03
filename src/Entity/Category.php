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
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'category')]
class Category
{
    use TimestampableTrait;

    #[Id, Column(name: 'category_id', type: 'integer')]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $categoryId = null;

    #[Assert\Type(type: self::class)]
    #[ManyToOne(targetEntity: self::class, inversedBy: 'subCategories')]
    #[JoinColumn(name: 'parent_category_id', referencedColumnName: 'category_id')]
    private ?Category $parentCategory;

    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['debit', 'credit'])]
    #[Column(name: 'type', type: 'string', length: 8)]
    private ?string $type = null;

    #[Assert\NotBlank]
    #[Assert\Length(max: 32)]
    #[Column(name: 'name', type: 'string', length: 32)]
    private ?string $name = null;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_active', type: 'boolean', options: ['default' => true])]
    private ?bool $active = true;

    #[OneToMany(targetEntity: self::class, mappedBy: 'parentCategory', fetch: 'EXTRA_LAZY')]
    private Collection $subCategories;

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

    public function setParentCategory(?self $parentCategory): void
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
