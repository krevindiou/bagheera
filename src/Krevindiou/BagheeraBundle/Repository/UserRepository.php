<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
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
     * @param  array              $params Search criterias
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
