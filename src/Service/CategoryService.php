<?php

declare(strict_types=1);

namespace App\Service;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;

class CategoryService
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    public function getList(): ArrayCollection
    {
        return $this->em->getRepository('App:Category')->getList();
    }
}
