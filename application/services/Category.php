<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Application\Services;

/**
 * Category service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Category extends CrudAbstract
{
    public function getList()
    {
        $list = array();

        $dql = 'SELECT c1._type c1_type, c1._name c1_name, c1._categoryId c1_categoryId, ';
        $dql.= 'c2._name c2_name, c2._categoryId c2_categoryId, ';
        $dql.= 'c3._name c3_name, c3._categoryId c3_categoryId ';
        $dql.= 'FROM Application\\Models\\Category c1 ';
        $dql.= 'LEFT JOIN c1._subCategories c2 ';
        $dql.= 'LEFT JOIN c2._subCategories c3 ';
        $dql.= 'WHERE c1._parentCategoryId IS NULL ';
        $dql.= 'ORDER BY c1._name ASC, c2._name ASC, c3._name ASC ';
        $q = $this->_em->createQuery($dql);
        $categories = $q->getResult();

        foreach ($categories as $category) {
            foreach ($category as $k => $v) {
                if ('_categoryId' == substr($k, -11) && '' != $v) {
                    $list[$category['c1_type']][$v] = '';

                    for ($i = 1; $i <= substr($k, 1, 1); $i++) {
                        $list[$category['c1_type']][$v].= $category[substr($k, 0, 1) . $i . '_name'] . ' > ';
                    }

                    $list[$category['c1_type']][$v] = trim($list[$category['c1_type']][$v], '> ');
                }
            }
        }

        return $list;
    }
}
