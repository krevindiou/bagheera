<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\Member;
use Doctrine\ORM\EntityRepository;

class OperationRepository extends EntityRepository
{
    public function getLastExternalOperationId(Account $account): ?string
    {
        $dql = 'SELECT o.externalOperationId ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.account = :account ';
        $dql .= 'ORDER BY o.externalOperationId DESC ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('account', $account);
        $query->setMaxResults(1);

        try {
            return $query->getSingleScalarResult();
        } catch (\Doctrine\ORM\NoResultException $e) {
            return null;
        }
    }

    /**
     * Gets total amount by month.
     *
     * @param Member   $member    Member entity
     * @param DateTime $startDate Sum calculated after this date
     * @param DateTime $endDate   Sum calculated before this date
     * @param Account  $account   Synthesis for specific account
     *
     * @return array
     */
    public function getTotalByMonth(Member $member, \DateTime $startDate, \DateTime $endDate, Account $account = null): array
    {
        $data = $this->getSumsByMonth($member, $startDate, $endDate, $account);

        if (!empty($data)) {
            $previousMonthTotal = $this->getSumBefore($member, $startDate, $account);

            foreach ($data as $currency => $value) {
                foreach ($value as $month => $total) {
                    if (isset($previousMonthTotal[$currency])) {
                        $data[$currency][$month] += $previousMonthTotal[$currency];
                    }

                    $previousMonthTotal[$currency] = $data[$currency][$month];
                }
            }
        }

        return $data;
    }

    /**
     * Gets operations sum for each month.
     *
     * @param Member   $member    Member entity
     * @param DateTime $startDate Sum calculated after this date
     * @param DateTime $endDate   Sum calculated before this date
     * @param Account  $account   Synthesis for specific account
     *
     * @return array
     */
    protected function getSumsByMonth(Member $member, \DateTime $startDate, \DateTime $endDate, Account $account = null): array
    {
        $data = [];

        $sql = 'SELECT a.currency, TO_CHAR(o.value_date, \'YYYY-MM\') AS month, (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS total ';
        $sql .= 'FROM account a ';
        $sql .= 'LEFT JOIN operation o ON o.account_id = a.account_id ';
        $sql .= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql .= 'WHERE b.member_id = :member_id ';
        $sql .= 'AND a.is_deleted = false ';
        $sql .= 'AND b.is_deleted = false ';
        $sql .= 'AND TO_CHAR(o.value_date, \'YYYY-MM-DD\') >= :start_date ';
        $sql .= 'AND TO_CHAR(o.value_date, \'YYYY-MM-DD\') <= :end_date ';

        if (null !== $account) {
            $sql .= 'AND a.account_id = :account_id ';
        }

        $sql .= 'GROUP BY a.currency, month ';
        $sql .= 'ORDER BY month ASC ';

        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);
        $stmt->bindValue('member_id', $member->getMemberId());
        $stmt->bindValue('start_date', $startDate->format('Y-m-d'));
        $stmt->bindValue('end_date', $endDate->format('Y-m-d'));

        if (null !== $account) {
            $stmt->bindValue('account_id', $account->getAccountId());
        }

        $stmt->execute();

        $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (!empty($results)) {
            foreach ($results as $result) {
                $data[$result['currency']][$result['month']] = $result['total'];
            }
        }

        $periodInterval = new \DateInterval('P1M');
        $periodIterator = new \DatePeriod($startDate, $periodInterval, $endDate);

        foreach ($periodIterator as $date) {
            $month = $date->format('Y-m');

            foreach ($data as $currency => $value) {
                if (!isset($data[$currency][$month])) {
                    $data[$currency][$month] = 0;
                }
            }
        }

        foreach ($data as $currency => $value) {
            ksort($data[$currency]);
        }

        return $data;
    }

    /**
     * Gets operations sum before a specified date.
     *
     * @param Member   $member  Member entity
     * @param DateTime $endDate Sum calculated before this date
     *
     * @return array
     */
    protected function getSumBefore(Member $member, \DateTime $endDate, Account $account = null): array
    {
        $data = [];

        $sql = 'SELECT a.currency, (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS total ';
        $sql .= 'FROM account a ';
        $sql .= 'LEFT JOIN operation o ON o.account_id = a.account_id ';
        $sql .= 'LEFT JOIN bank b ON b.bank_id = a.bank_id ';
        $sql .= 'WHERE b.member_id = :member_id ';
        $sql .= 'AND a.is_deleted = false ';
        $sql .= 'AND b.is_deleted = false ';
        $sql .= 'AND TO_CHAR(o.value_date, \'YYYY-MM-DD\') < :end_date ';

        if (null !== $account) {
            $sql .= 'AND a.account_id = :account_id ';
        }

        $sql .= 'GROUP BY a.currency ';

        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);
        $stmt->bindValue('member_id', $member->getMemberId());
        $stmt->bindValue('end_date', $endDate->format('Y-m-d'));

        if (null !== $account) {
            $stmt->bindValue('account_id', $account->getAccountId());
        }

        $stmt->execute();

        $results = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (!empty($results)) {
            foreach ($results as $result) {
                $data[$result['currency']] = $result['total'];
            }
        }

        return $data;
    }
}
