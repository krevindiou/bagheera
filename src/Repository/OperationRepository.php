<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\OperationSearch;
use App\Entity\Scheduler;
use Doctrine\ORM\EntityRepository;
use Pagerfanta\Adapter\CallbackAdapter;
use Pagerfanta\Pagerfanta;

class OperationRepository extends EntityRepository
{
    public function getList(Member $member, Account $account, int $currentPage = 1, OperationSearch $operationSearch = null): Pagerfanta
    {
        $params = [
            ':account_id' => $account->getAccountId(),
        ];

        $sql = 'SELECT
            operation.operation_id,
            operation.external_operation_id AS external_operation_id,
            operation.third_party AS operation_third_party,
            operation.debit AS operation_debit,
            operation.credit AS operation_credit,
            operation.value_date AS operation_value_date,
            operation.is_reconciled AS operation_is_reconciled,
            operation.notes AS operation_notes,
            scheduler.scheduler_id AS scheduler_id,
            account.account_id AS account_id,
            account.name AS account_name,
            account.currency AS account_currency,
            transfer_account.account_id AS transfer_account_id,
            transfer_account.name AS transfer_account_name,
            transfer_operation.operation_id AS transfer_operation_id,
            category.category_id AS category_id,
            category.name AS category_name,
            payment_method.payment_method_id AS payment_method_id,
            payment_method.name AS payment_method_name
            ';
        $sql .= 'FROM operation ';
        $sql .= 'INNER JOIN account ON operation.account_id = account.account_id ';
        $sql .= 'LEFT JOIN scheduler ON operation.scheduler_id = scheduler.scheduler_id ';
        $sql .= 'LEFT JOIN account AS transfer_account ON operation.transfer_account_id = transfer_account.account_id ';
        $sql .= 'LEFT JOIN operation AS transfer_operation ON operation.transfer_operation_id = transfer_operation.operation_id ';
        $sql .= 'LEFT JOIN category ON operation.category_id = category.category_id ';
        $sql .= 'LEFT JOIN payment_method ON operation.payment_method_id = payment_method.payment_method_id ';
        $sql .= 'WHERE operation.account_id = :account_id ';

        if (null !== $operationSearch) {
            if ('' !== $operationSearch->getThirdParty()) {
                $sql .= 'AND operation.third_party LIKE :third_party ';
                $params[':third_party'] = '%'.$operationSearch->getThirdParty().'%';
            }
            if (0 !== count($operationSearch->getCategories())) {
                $categories = array_map(
                    function ($value) {
                        return $value->getCategoryId();
                    },
                    $operationSearch->getCategories()->toArray()
                );

                $sql .= 'AND operation.category_id IN ('.implode(',', $categories).') ';
            }
            if (0 !== count($operationSearch->getPaymentMethods())) {
                $paymentMethods = array_map(
                    function ($value) {
                        return $value->getPaymentMethodId();
                    },
                    $operationSearch->getPaymentMethods()->toArray()
                );

                $sql .= 'AND operation.payment_method_id IN ('.implode(',', $paymentMethods).') ';
            }
            if (null !== $operationSearch->getAmountInferiorTo()) {
                $sql .= 'AND operation.'.$operationSearch->getType().' < :amount_inferior_to ';
                $params[':amount_inferior_to'] = $operationSearch->getAmountInferiorTo();
            }
            if (null !== $operationSearch->getAmountInferiorOrEqualTo()) {
                $sql .= 'AND operation.'.$operationSearch->getType().' <= :amount_inferior_or_equal_to ';
                $params[':amount_inferior_or_equal_to'] = $operationSearch->getAmountInferiorOrEqualTo();
            }
            if (null !== $operationSearch->getAmountEqualTo()) {
                $sql .= 'AND operation.'.$operationSearch->getType().' = :amount_equal_to ';
                $params[':amount_equal_to'] = $operationSearch->getAmountEqualTo();
            }
            if (null !== $operationSearch->getAmountSuperiorOrEqualTo()) {
                $sql .= 'AND operation.'.$operationSearch->getType().' >= :amount_superior_or_equal_to ';
                $params[':amount_superior_or_equal_to'] = $operationSearch->getAmountSuperiorOrEqualTo();
            }
            if (null !== $operationSearch->getAmountSuperiorTo()) {
                $sql .= 'AND operation.'.$operationSearch->getType().' > :amount_superior_to ';
                $params[':amount_superior_to'] = $operationSearch->getAmountSuperiorTo();
            }
            if (null !== $operationSearch->getValueDateStart()) {
                $sql .= 'AND operation.value_date >= :value_date_start ';
                $params[':value_date_start'] = $operationSearch->getValueDateStart()->format(\DateTime::ISO8601);
            }
            if (null !== $operationSearch->getValueDateEnd()) {
                $sql .= 'AND operation.value_date <= :value_date_end ';
                $params[':value_date_end'] = $operationSearch->getValueDateEnd()->format(\DateTime::ISO8601);
            }
            if ('' !== $operationSearch->getNotes()) {
                $sql .= 'AND operation.notes LIKE :notes ';
                $params[':notes'] = '%'.$operationSearch->getNotes().'%';
            }
            if (null !== $operationSearch->isReconciled()) {
                $sql .= 'AND operation.is_reconciled = :reconciled ';
                $params[':reconciled'] = $operationSearch->isReconciled() ? 'true' : 'false';
            }
        }

        $sql .= 'ORDER BY operation.value_date DESC ';

        $conn = $this->getEntityManager()->getConnection();

        $getNbResultsCallback = function () use ($sql, $conn, $params) {
            $start = strpos($sql, ' FROM ');
            $length = strpos($sql, ' ORDER BY ') - $start;

            $sqlCount = 'SELECT COUNT(*) AS total ';
            $sqlCount .= substr($sql, $start, $length);

            $stmt = $conn->prepare($sqlCount);
            $stmt->execute($params);

            return $stmt->fetchColumn();
        };

        $getSliceCallback = function ($offset, $length) use ($sql, $conn, $params) {
            $sql .= 'LIMIT :length OFFSET :offset';

            $params[':length'] = $length;
            $params[':offset'] = $offset;

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            $operations = [];

            foreach ($stmt->fetchAll() as $row) {
                if (!isset($operations[$row['operation_id']])) {
                    $operations[$row['operation_id']] = [
                        'operationId' => $row['operation_id'],
                        'scheduler' => [
                            'schedulerId' => $row['scheduler_id'],
                        ],
                        'account' => [
                            'accountId' => $row['account_id'],
                            'currency' => $row['account_currency'],
                            'name' => $row['account_name'],
                        ],
                        'transferAccount' => [
                            'accountId' => $row['transfer_account_id'],
                            'name' => $row['transfer_account_name'],
                        ],
                        'transferOperation' => [
                            'operationId' => $row['transfer_operation_id'],
                        ],
                        'category' => [
                            'categoryId' => $row['category_id'],
                            'name' => $row['category_name'],
                        ],
                        'paymentMethod' => [
                            'paymentMethodId' => $row['payment_method_id'],
                            'name' => $row['payment_method_name'],
                        ],
                        'externalOperationId' => $row['external_operation_id'],
                        'thirdParty' => $row['operation_third_party'],
                        'debit' => $row['operation_debit'],
                        'credit' => $row['operation_credit'],
                        'amount' => (0 != $row['operation_credit']) ? $row['operation_credit'] : -$row['operation_debit'],
                        'valueDate' => (null !== $row['operation_value_date']) ? new \DateTime($row['operation_value_date']) : null,
                        'reconciled' => $row['operation_is_reconciled'],
                        'notes' => $row['operation_notes'],
                    ];
                }
            }

            return $operations;
        };

        $adapter = new CallbackAdapter($getNbResultsCallback, $getSliceCallback);

        $pager = new Pagerfanta($adapter);
        $pager->setMaxPerPage(20);
        $pager->setCurrentPage($currentPage);

        return $pager;
    }

    public function findThirdParties(Member $member, string $queryString = null): array
    {
        $sql = 'SELECT o2.third_party AS "thirdParty", o2.category_id AS "categoryId" ';
        $sql .= 'FROM ( ';
        $sql .= '    SELECT o.third_party, MAX(o.value_date) AS max_value_date ';
        $sql .= '    FROM operation o ';
        $sql .= '    INNER JOIN account a ON o.account_id = a.account_id ';
        $sql .= '    INNER JOIN bank b ON a.bank_id = b.bank_id ';
        $sql .= '    WHERE b.member_id = :member_id ';
        $sql .= '    AND o.third_party ILIKE :third_party ';
        $sql .= '    GROUP BY o.third_party ';
        $sql .= ') AS tmp ';
        $sql .= 'INNER JOIN operation o2 ON o2.third_party = tmp.third_party AND o2.value_date = tmp.max_value_date ';
        $sql .= 'GROUP BY o2.third_party, o2.category_id ';

        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);
        $stmt->bindValue('member_id', $member->getMemberId());
        $stmt->bindValue('third_party', '%'.$queryString.'%');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    public function getLastFromCategory(Member $member, Category $category): ?Operation
    {
        $dql = 'SELECT o ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'JOIN o.account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND o.category = :category ';
        $dql .= 'AND b.deleted = false ';
        $dql .= 'AND b.closed = false ';
        $dql .= 'AND a.deleted = false ';
        $dql .= 'AND a.closed = false ';
        $dql .= 'ORDER BY o.valueDate DESC ';

        $query = $this->getEntityManager()->createQuery($dql)->setMaxResults(1);
        $query->setParameter('member', $member);
        $query->setParameter('category', $category);

        return $query->getOneOrNullResult();
    }

    public function getLastBiggestExpense(Member $member, \DateTime $since): ?Operation
    {
        $dql = 'SELECT o ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.debit = ( ';
        $dql .= '  SELECT MAX(o2.debit) ';
        $dql .= '  FROM App:Operation o2 ';
        $dql .= '  JOIN o2.account a ';
        $dql .= '  JOIN a.bank b ';
        $dql .= '  WHERE b.member = :member ';
        $dql .= '  AND o2.debit > 0 ';
        $dql .= '  AND o2.scheduler IS NULL ';
        $dql .= '  AND o2.valueDate >= :valueDate ';
        $dql .= '  AND b.deleted = false ';
        $dql .= '  AND b.closed = false ';
        $dql .= '  AND a.deleted = false ';
        $dql .= '  AND a.closed = false ';
        $dql .= ') ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setMaxResults(1);
        $query->setParameter('member', $member);
        $query->setParameter('valueDate', $since->format(\DateTime::ISO8601));

        return $query->getOneOrNullResult();
    }

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

    public function getGraphValues(Report $report, array $accounts, string $type): array
    {
        switch ($report->getPeriodGrouping()) {
            case 'month':
                $groupingData = 'TO_CHAR(o.value_date, \'YYYY-MM-01\')';

                break;
            case 'quarter':
                $groupingData = 'CONCAT(TO_CHAR(o.value_date, \'YYYY-\'), LPAD(FLOOR((TO_CHAR(o.value_date, \'MM\')::integer - 1) / 3) * 3 + 1, 2, \'0\'), \'-01\')';

                break;
            case 'year':
                $groupingData = 'TO_CHAR(o.value_date, \'YYYY-01-01\')';

                break;
            default:
                $groupingData = '';
        }

        $sql = 'SELECT '.(('' !== $groupingData) ? $groupingData.' AS grouping_data, ' : '');
        $sql .= (('average' === $type) ? 'AVG' : 'SUM').'(o.credit) AS data_1, '.(('average' === $type) ? 'AVG' : 'SUM').'(o.debit) AS data_2 ';
        $sql .= 'FROM operation AS o ';

        $accountsId = [];
        foreach ($accounts as $account) {
            $accountsId[] = $account->getAccountId();
        }

        $sql .= 'WHERE o.account_id IN ('.implode(', ', $accountsId).') ';
        if (null !== $report->getValueDateStart()) {
            $sql .= 'AND o.value_date >= :value_date_start ';
        }
        if (null !== $report->getValueDateEnd()) {
            $sql .= 'AND o.value_date <= :value_date_end ';
        }
        if (null !== $report->getThirdParties()) {
            $sql .= 'AND o.third_party LIKE :third_parties ';
        }
        if ($report->getReconciledOnly()) {
            $sql .= 'AND o.is_reconciled = true ';
        }
        if ('' !== $groupingData) {
            $sql .= 'GROUP BY grouping_data ';
            $sql .= 'ORDER BY grouping_data ASC ';
        }

        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);
        if (null !== $report->getValueDateStart()) {
            $stmt->bindValue('value_date_start', $report->getValueDateStart()->format(\DateTime::ISO8601));
        }
        if (null !== $report->getValueDateEnd()) {
            $stmt->bindValue('value_date_end', $report->getValueDateEnd()->format(\DateTime::ISO8601));
        }
        if (null !== $report->getThirdParties()) {
            $stmt->bindValue('third_parties', '%'.$report->getThirdParties().'%');
        }

        $stmt->execute();

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function getLastScheduledOperationDate(Scheduler $scheduler): array
    {
        $dql = 'SELECT o.valueDate ';
        $dql .= 'FROM App:Operation o ';
        $dql .= 'WHERE o.scheduler = :scheduler ';
        $dql .= 'AND o.valueDate >= :valueDate ';
        $dql .= 'ORDER BY o.valueDate DESC ';

        $query = $this->getEntityManager()->createQuery($dql);
        $query->setMaxResults(1);
        $query->setParameter('scheduler', $scheduler);
        $query->setParameter('valueDate', $scheduler->getValueDate()->format(\DateTime::ISO8601));

        return $query->getResult();
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
