<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Repository;

use Doctrine\ORM\EntityRepository,
    Krevindiou\BagheeraBundle\Entity\User;

/**
 * Account repository
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class AccountRepository extends EntityRepository
{
    /**
     * Gets initial balances sum for each month
     *
     * @param  User $user           User entity
     * @param  DateTime $startDate  Sum calculated after this date
     * @param  DateTime $stopDate   Sum calculated before this date
     * @return array
     */
    protected function _getInitialBalancesByMonth(User $user, \DateTime $startDate, \DateTime $stopDate)
    {
        $data = array();

        $sql = 'SELECT a.currency, COALESCE(SUM(a.initial_balance), 0) AS total, DATE_FORMAT(a.created_at, "%Y-%m") AS month ';
        $sql.= 'FROM account a ';
        $sql.= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql.= 'WHERE b.user_id = :user_id ';
        $sql.= 'AND a.is_deleted = 0 ';
        $sql.= 'AND b.is_deleted = 0 ';
        $sql.= 'AND DATE_FORMAT(a.created_at, "%Y-%m-%d") >= :start_date ';
        $sql.= 'AND DATE_FORMAT(a.created_at, "%Y-%m-%d") <= :stop_date ';
        $sql.= 'GROUP BY a.currency, month ';
        $sql.= 'ORDER BY month ';

        $stmt = $this->_em->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $user->getUserId());
        $stmt->bindValue('start_date', $startDate->format('Y-m-d'));
        $stmt->bindValue('stop_date', $stopDate->format('Y-m-d'));
        $stmt->execute();

        $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (!empty($results)) {
            foreach ($results as $result) {
                $data[$result['currency']][$result['month']] = $result['total'];

                if (isset($start[$result['currency']])) {
                    $data[$result['currency']][$result['month']]+= $start[$result['currency']];
                }
            }
        }

        $dateTmp = clone $startDate;
        while ($dateTmp <= $stopDate) {
            foreach ($data as $currency => $value) {
                if (!isset($data[$currency][$dateTmp->format('Y-m')])) {
                    $data[$currency][$dateTmp->format('Y-m')] = 0;
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
     * Gets initial balances before a specified date
     *
     * @param  User $user User entity
     * @param  DateTime $stopDate Initial balances fetched before this date
     * @return array
     */
    protected function _getInitialBalancesBefore(User $user, \DateTime $stopDate)
    {
        $data = array();

        $sql = 'SELECT a.currency, COALESCE(SUM(a.initial_balance), 0) AS total ';
        $sql.= 'FROM account a ';
        $sql.= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql.= 'WHERE b.user_id = :user_id ';
        $sql.= 'AND a.is_deleted = 0 ';
        $sql.= 'AND b.is_deleted = 0 ';
        $sql.= 'AND DATE_FORMAT(a.created_at, "%Y-%m-%d") < :start_date ';
        $sql.= 'GROUP BY a.currency ';

        $stmt = $this->_em->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $user->getUserId());
        $stmt->bindValue('start_date', $stopDate->format('Y-m-d'));
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
     * Gets initial balances sum by month
     *
     * @param  User  $user          User entity
     * @param  DateTime $startDate  Initial balances fetched after this date
     * @param  DateTime $stopDate   Initial balances fetched before this date
     * @return array
     */
    public function getTotalInitialBalancesByMonth(User $user, \DateTime $startDate, \DateTime $stopDate)
    {
        $data = $this->_getInitialBalancesByMonth($user, $startDate, $stopDate);

        if (!empty($data)) {
            $previousMonthTotal = $this->_getInitialBalancesBefore($user, $startDate);

            foreach ($data as $currency => $value) {
                foreach ($value as $month => $total) {
                    if (isset($previousMonthTotal[$currency])) {
                        $data[$currency][$month]+= $previousMonthTotal[$currency];
                    }

                    $previousMonthTotal[$currency] = $data[$currency][$month];
                }
            }
        }

        return $data;
    }
}
