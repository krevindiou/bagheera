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

use Doctrine\ORM\EntityRepository,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\OperationSearch;

/**
 * Operation repository
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationRepository extends EntityRepository
{
    public function getQueryByAccount(Account $account, OperationSearch $operationSearch = null)
    {
        $qb = $this->getEntityManager()->createQueryBuilder();
        $qb->select('o')
            ->from('KrevindiouBagheeraBundle:Operation', 'o')
            ->where('o.account = :account')->setParameter('account', $account)
            ->orderBy('o.valueDate', 'DESC');

        if (null !== $operationSearch) {
            if ('' != $operationSearch->getThirdParty()) {
                $qb->andWhere($qb->expr()->like('o.thirdParty', ':thirdParty'))
                   ->setParameter('thirdParty', '%' . $operationSearch->getThirdParty() . '%');
            }
            if (0 != count($operationSearch->getCategories())) {
                $qb->andWhere($qb->expr()->in('o.category', ':categories'))
                   ->setParameter('categories', iterator_to_array($operationSearch->getCategories()));
            }
            if (0 != count($operationSearch->getPaymentMethods())) {
                $qb->andWhere($qb->expr()->in('o.paymentMethod', ':paymentMethods'))
                   ->setParameter('paymentMethods', iterator_to_array($operationSearch->getPaymentMethods()));
            }
            if (null !== $operationSearch->getAmountInferiorTo()) {
                $qb->andWhere($qb->expr()->lt('o.' . $operationSearch->getType(), ':amountInferiorTo'))
                   ->setParameter('amountInferiorTo', $operationSearch->getAmountInferiorTo());
            }
            if (null !== $operationSearch->getAmountInferiorOrEqualTo()) {
                $qb->andWhere($qb->expr()->lte('o.' . $operationSearch->getType(), ':amountInferiorOrEqualTo'))
                   ->setParameter('amountInferiorOrEqualTo', $operationSearch->getAmountInferiorOrEqualTo());
            }
            if (null !== $operationSearch->getAmountEqualTo()) {
                $qb->andWhere($qb->expr()->eq('o.' . $operationSearch->getType(), ':amountEqualTo'))
                   ->setParameter('amountEqualTo', $operationSearch->getAmountEqualTo());
            }
            if (null !== $operationSearch->getAmountSuperiorOrEqualTo()) {
                $qb->andWhere($qb->expr()->gte('o.' . $operationSearch->getType(), ':amountSuperiorOrEqualTo'))
                   ->setParameter('amountSuperiorOrEqualTo', $operationSearch->getAmountSuperiorOrEqualTo());
            }
            if (null !== $operationSearch->getAmountSuperiorTo()) {
                $qb->andWhere($qb->expr()->gt('o.' . $operationSearch->getType(), ':amountSuperiorTo'))
                   ->setParameter('amountSuperiorTo', $operationSearch->getAmountSuperiorTo());
            }
            if (null !== $operationSearch->getValueDateStart()) {
                $qb->andWhere($qb->expr()->gte('o.valueDate', ':valueDateStart'))
                   ->setParameter('valueDateStart', $operationSearch->getValueDateStart());
            }
            if (null !== $operationSearch->getValueDateEnd()) {
                $qb->andWhere($qb->expr()->lte('o.valueDate', ':valueDateEnd'))
                   ->setParameter('valueDateEnd', $operationSearch->getValueDateEnd());
            }
            if ('' != $operationSearch->getNotes()) {
                $qb->andWhere($qb->expr()->like('o.notes', ':notes'))
                   ->setParameter('notes', '%' . $operationSearch->getNotes() . '%');
            }
            if (null !== $operationSearch->getIsReconciled()) {
                $qb->andWhere($qb->expr()->eq('o.isReconciled', ':isReconciled'))
                   ->setParameter('isReconciled', $operationSearch->getIsReconciled());
            }
        }

        return $qb->getQuery();
    }

    public function getLastExternalOperationId(Account $account)
    {
        $em = $this->getEntityManager();

        $dql = 'SELECT o.externalOperationId ';
        $dql.= 'FROM KrevindiouBagheeraBundle:Operation o ';
        $dql.= 'WHERE o.account = :account ';
        $dql.= 'ORDER BY o.externalOperationId DESC ';

        $query = $em->createQuery($dql);
        $query->setParameter('account', $account);
        $query->setMaxResults(1);

        try {
            return $query->getSingleScalarResult();
        } catch (\Doctrine\ORM\NoResultException $e) {
            return null;
        }
    }
}
