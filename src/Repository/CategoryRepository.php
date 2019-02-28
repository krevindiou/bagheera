<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Category;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Bridge\Doctrine\RegistryInterface;

class CategoryRepository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, Category::class);
    }

    public function getList(): ArrayCollection
    {
        $list = [];

        $dql =<<<'EOT'
        SELECT c1.type c1_type, c1.name c1_name, c1.categoryId c1_categoryId,
        c2.name c2_name, c2.categoryId c2_categoryId,
        c3.name c3_name, c3.categoryId c3_categoryId
        FROM App:Category c1
        LEFT JOIN c1.subCategories c2
        LEFT JOIN c2.subCategories c3
        WHERE c1.parentCategory IS NULL
        ORDER BY c1.name ASC, c2.name ASC, c3.name ASC
EOT;
        $q = $this->getEntityManager()->createQuery($dql);
        $categories = $q->getResult();
        foreach ($categories as $category) {
            foreach ($category as $k => $v) {
                if ('categoryId' === substr($k, -10) && null !== $v) {
                    $list[$category['c1_type']][$v] = '';

                    $nb = substr($k, 1, 1);
                    for ($i = 1; $i <= $nb; ++$i) {
                        $list[$category['c1_type']][$v] .= $category[substr($k, 0, 1).$i.'_name'].' > ';
                    }

                    $list[$category['c1_type']][$v] = trim($list[$category['c1_type']][$v], '> ');
                }
            }
        }

        return new ArrayCollection($list);
    }

    public function getCategories(array $categoriesId): ArrayCollection
    {
        $dql =<<<'EOT'
        SELECT c
        FROM App:Category c
        WHERE c.categoryId IN (%s)
EOT;
        $query = $this->getEntityManager()->createQuery(sprintf($dql, implode(', ', $categoriesId)));

        return new ArrayCollection($query->getResult());
    }
}
