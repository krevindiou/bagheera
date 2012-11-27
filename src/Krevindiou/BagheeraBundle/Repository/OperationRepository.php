<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Repository;

use Doctrine\ORM\EntityRepository,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\User,
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

    /**
     * Gets operations sum for each month
     *
     * @param  User $user           User entity
     * @param  DateTime $startDate  Sum calculated after this date
     * @param  DateTime $stopDate   Sum calculated before this date
     * @return array
     */
    protected function _getSumsByMonth(User $user, \DateTime $startDate, \DateTime $stopDate)
    {
        $data = array();

        $sql = 'SELECT a.currency, DATE_FORMAT(o.value_date, "%Y-%m") AS month, (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS total ';
        $sql.= 'FROM account a ';
        $sql.= 'LEFT JOIN operation o ON o.account_id = a.account_id ';
        $sql.= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql.= 'WHERE b.user_id = :user_id ';
        $sql.= 'AND a.is_deleted = 0 ';
        $sql.= 'AND b.is_deleted = 0 ';
        $sql.= 'AND DATE_FORMAT(o.value_date, "%Y-%m-%d") >= :start_date ';
        $sql.= 'AND DATE_FORMAT(o.value_date, "%Y-%m-%d") <= :stop_date ';
        $sql.= 'GROUP BY a.currency, month ';
        $sql.= 'ORDER BY month ASC ';

        $stmt = $this->_em->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $user->getUserId());
        $stmt->bindValue('start_date', $startDate->format('Y-m-d'));
        $stmt->bindValue('stop_date', $stopDate->format('Y-m-d'));
        $stmt->execute();

        $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (!empty($results)) {
            foreach ($results as $result) {
                $data[$result['currency']][$result['month']] = $result['total'];
            }
        }

        $dateTmp = clone $startDate;
        while ($dateTmp <= $stopDate) {
            $month = $dateTmp->format('Y-m');

            foreach ($data as $currency => $value) {
                if (!isset($data[$currency][$month])) {
                    $data[$currency][$month] = 0;
                }
            }

            $dateTmp->modify('+1 month');
        }

        foreach ($data as $currency => $value) {
            ksort($data[$currency]);
        }

        return $data;
    }

    /**
     * Gets operations sum before a specified date
     *
     * @param  User $user User entity
     * @param  DateTime $stopDate Sum calculated before this date
     * @return array
     */
    protected function _getSumBefore(User $user, \DateTime $stopDate)
    {
        $data = array();

        $sql = 'SELECT a.currency, (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS total ';
        $sql.= 'FROM account a ';
        $sql.= 'LEFT JOIN operation o ON o.account_id = a.account_id ';
        $sql.= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql.= 'WHERE b.user_id = :user_id ';
        $sql.= 'AND a.is_deleted = 0 ';
        $sql.= 'AND b.is_deleted = 0 ';
        $sql.= 'AND DATE_FORMAT(o.value_date, "%Y-%m-%d") < :stop_date ';
        $sql.= 'GROUP BY a.currency ';

        $stmt = $this->_em->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $user->getUserId());
        $stmt->bindValue('stop_date', $stopDate->format('Y-m-d'));
        $stmt->execute();

        $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (!empty($results)) {
            foreach ($results as $result) {
                $data[$result['currency']] = $result['total'];
            }
        }

        return $data;
    }

    /**
     * Gets total amount by month
     *
     * @param  User  $user          User entity
     * @param  DateTime $startDate  Sum calculated after this date
     * @param  DateTime $stopDate   Sum calculated before this date
     * @return array
     */
    public function getTotalByMonth(User $user, \DateTime $startDate, \DateTime $stopDate)
    {
        $data = $this->_getSumsByMonth($user, $startDate, $stopDate);

        $initialBalances = $this->_em->getRepository('KrevindiouBagheeraBundle:Account')->getTotalInitialBalancesByMonth($user, $startDate, $stopDate);

        if (!empty($data)) {
            $previousMonthTotal = $this->_getSumBefore($user, $startDate);

            foreach ($data as $currency => $value) {
                foreach ($value as $month => $total) {
                    if (isset($previousMonthTotal[$currency])) {
                        $data[$currency][$month]+= $previousMonthTotal[$currency];
                    }

                    $previousMonthTotal[$currency] = $data[$currency][$month];
                }
            }

            foreach ($data as $currency => $value) {
                foreach ($value as $month => $total) {
                    if (isset($initialBalances[$currency][$month])) {
                        $data[$currency][$month]+= $initialBalances[$currency][$month];
                    }
                }
            }
        }

        return $data;
    }
}
