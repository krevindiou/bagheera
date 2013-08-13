<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Repository;

use Doctrine\ORM\EntityRepository;

class MemberRepository extends EntityRepository
{
    /**
     * Gets members query
     *
     * @param  array              $params Search criterias
     * @return Doctrine\ORM\Query
     */
    public function getListQuery(array $params = array())
    {
        $dql = 'SELECT m ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Member m ';
        $dql.= 'WHERE 1 = 1 ';
        if (!empty($params)) {
            if (isset($params['email']) && '' != $params['email']) {
                $dql.= 'AND m.email LIKE :email ';
            }
            if (isset($params['active']) && '' != $params['active']) {
                $dql.= 'AND m.active = :active ';
            }
            if (isset($params['admin']) && '' != $params['admin']) {
                $dql.= 'AND m.admin = :admin ';
            }
        }
        $dql.= 'ORDER BY m.createdAt DESC ';
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
