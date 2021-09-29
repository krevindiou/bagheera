<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\CategoryRepository;
use Doctrine\Common\Collections\ArrayCollection;

class CategoryService
{
    public function __construct(private CategoryRepository $categoryRepository)
    {
    }

    public function getList(): ArrayCollection
    {
        return $this->categoryRepository->getList();
    }
}
