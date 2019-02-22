<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\CategoryRepository;
use Doctrine\Common\Collections\ArrayCollection;

class CategoryService
{
    private $categoryRepository;

    public function __construct(CategoryRepository $categoryRepository)
    {
        $this->categoryRepository = $categoryRepository;
    }

    public function getList(): ArrayCollection
    {
        return $this->categoryRepository->getList();
    }
}
