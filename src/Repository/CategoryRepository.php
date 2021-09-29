<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Category;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;

class CategoryRepository
{
    /**
     * @var EntityRepository<Category>
     */
    private EntityRepository $repository;

    public function __construct(private EntityManagerInterface $entityManager)
    {
        $this->repository = $entityManager->getRepository(Category::class);
    }

    public function getList(): ArrayCollection
    {
        return new ArrayCollection($this->repository->findAll());
    }

    public function getCategories(array $categoriesId): ArrayCollection
    {
        $dql = <<<'EOT'
            SELECT c
            FROM App:Category c
            WHERE c.categoryId IN (%s)
            EOT;
        $query = $this->entityManager->createQuery(sprintf($dql, implode(', ', $categoriesId)));

        return new ArrayCollection($query->getResult());
    }
}
