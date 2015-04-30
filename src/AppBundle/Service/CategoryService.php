<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Service;

use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\Service("app.category")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "category"})
 */
class CategoryService
{
    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    public function getList()
    {
        $list = [];

        $dql = 'SELECT c1.type c1_type, c1.name c1_name, c1.categoryId c1_categoryId, ';
        $dql .= 'c2.name c2_name, c2.categoryId c2_categoryId, ';
        $dql .= 'c3.name c3_name, c3.categoryId c3_categoryId ';
        $dql .= 'FROM AppBundle:Category c1 ';
        $dql .= 'LEFT JOIN c1.subCategories c2 ';
        $dql .= 'LEFT JOIN c2.subCategories c3 ';
        $dql .= 'WHERE c1.parentCategory IS NULL ';
        $dql .= 'ORDER BY c1.name ASC, c2.name ASC, c3.name ASC ';
        $q = $this->em->createQuery($dql);
        $categories = $q->getResult();
        foreach ($categories as $category) {
            foreach ($category as $k => $v) {
                if ('categoryId' == substr($k, -10) && '' != $v) {
                    $list[$category['c1_type']][$v] = '';

                    $nb = substr($k, 1, 1);
                    for ($i = 1; $i <= $nb; $i++) {
                        $list[$category['c1_type']][$v] .= $category[substr($k, 0, 1).$i.'_name'].' > ';
                    }

                    $list[$category['c1_type']][$v] = trim($list[$category['c1_type']][$v], '> ');
                }
            }
        }

        return $list;
    }
}
