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
     * Gets last 12 months initial balance sum by month
     *
     * @param  User $user User entity
     * @return array
     */
    public function getLast12MonthsInitialBalanceByMonth(User $user)
    {
        $sql = 'SELECT SUM(initial_balance) AS total, DATE_FORMAT(a.created_at, "%Y-%m") AS month ';
        $sql.= 'FROM account a ';
        $sql.= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql.= 'WHERE b.user_id = :user ';
        $sql.= 'AND a.is_deleted = 0 ';
        $sql.= 'AND b.is_deleted = 0 ';
        $sql.= 'AND DATE_FORMAT(a.created_at, "%Y-%m-%d") > LAST_DAY(DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)) ';
        $sql.= 'AND DATE_FORMAT(a.created_at, "%Y-%m-%d") <= LAST_DAY(CURRENT_DATE()) ';
        $sql.= 'GROUP BY month ORDER BY month ';

        $stmt = $this->_em->getConnection()->prepare($sql);
        $stmt->bindValue('user', $user->getUserId());
        $stmt->execute();

        $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        $data = array();

        if (!empty($results)) {
            foreach ($results as $result) {
                $data[$result['month']] = $result['total'];
            }
        }

        return $data;
    }

    /**
     * Gets initial balance sum before the last 12 months
     *
     * @param  User $user User entity
     * @return int
     */
    public function getInitialBalanceBeforeLast12Months(User $user)
    {
        $sql = 'SELECT SUM(a.initial_balance) ';
        $sql.= 'FROM account a ';
        $sql.= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql.= 'WHERE b.user_id = :user ';
        $sql.= 'AND a.is_deleted = 0 ';
        $sql.= 'AND b.is_deleted = 0 ';
        $sql.= 'AND DATE_FORMAT(a.created_at, "%Y-%m-%d") <= LAST_DAY(DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)) ';

        $stmt = $this->_em->getConnection()->prepare($sql);
        $stmt->bindValue('user', $user->getUserId());
        $stmt->execute();

        return $stmt->fetchColumn();
    }
}
