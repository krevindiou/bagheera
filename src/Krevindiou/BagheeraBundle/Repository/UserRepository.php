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

namespace Krevindiou\BagheeraBundle\Repository;

use Doctrine\ORM\EntityRepository;

/**
 * User repository
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserRepository extends EntityRepository
{
    /**
     * Gets users query
     *
     * @param  array $params Search criterias
     * @return Doctrine\ORM\Query
     */
    public function getListQuery(array $params = array())
    {
        $dql = 'SELECT u ';
        $dql.= 'FROM KrevindiouBagheeraBundle:User u ';
        $dql.= 'WHERE 1 = 1 ';
        if (!empty($params)) {
            if (isset($params['email']) && '' != $params['email']) {
                $dql.= 'AND u.email LIKE :email ';
            }
            if (isset($params['isActive']) && '' != $params['isActive']) {
                $dql.= 'AND u.isActive = :isActive ';
            }
            if (isset($params['isAdmin']) && '' != $params['isAdmin']) {
                $dql.= 'AND u.isAdmin = :isAdmin ';
            }
        }
        $dql.= 'ORDER BY u.createdAt DESC ';
        $query = $this->_em->createQuery($dql);
        if (!empty($params)) {
            if (isset($params['email']) && '' != $params['email']) {
                $query->setParameter('email', $params['email'] . '%');
            }
            if (isset($params['isActive']) && '' != $params['isActive']) {
                $query->setParameter('isActive', $params['isActive']);
            }
            if (isset($params['isAdmin']) && '' != $params['isAdmin']) {
                $query->setParameter('isAdmin', $params['isAdmin']);
            }
        }

        return $query;
    }
}
