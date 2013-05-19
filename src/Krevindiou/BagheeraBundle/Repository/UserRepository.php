<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Repository;

use Doctrine\ORM\EntityRepository;

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
            if (isset($params['active']) && '' != $params['active']) {
                $dql.= 'AND u.active = :active ';
            }
            if (isset($params['admin']) && '' != $params['admin']) {
                $dql.= 'AND u.admin = :admin ';
            }
        }
        $dql.= 'ORDER BY u.createdAt DESC ';
        $query = $this->getEntityManager()->createQuery($dql);
        if (!empty($params)) {
            if (isset($params['email']) && '' != $params['email']) {
                $query->setParameter('email', $params['email'] . '%');
            }
            if (isset($params['active']) && '' != $params['active']) {
                $query->setParameter('active', $params['active']);
            }
            if (isset($params['admin']) && '' != $params['admin']) {
                $query->setParameter('admin', $params['admin']);
            }
        }

        return $query;
    }
}
