<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Category;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Persistence\ManagerRegistry;

class CategoryRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Category::class);
    }

    public function getList(): ArrayCollection
    {
        return new ArrayCollection($this->findAll());
    }

    public function getCategories(array $categoriesId): ArrayCollection
    {
        $dql = <<<'EOT'
            SELECT c
            FROM App:Category c
            WHERE c.categoryId IN (%s)
            EOT;
        $query = $this->getEntityManager()->createQuery(sprintf($dql, implode(', ', $categoriesId)));

        return new ArrayCollection($query->getResult());
    }
}
