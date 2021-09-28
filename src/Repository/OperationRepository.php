<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\Member;
use App\Entity\Operation;
use App\Entity\PaymentMethod;
use App\Entity\Report;
use App\Entity\Scheduler;
use App\Form\Model\OperationSearchFormModel;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\NoResultException;
use Doctrine\Persistence\ManagerRegistry;
use Pagerfanta\Adapter\CallbackAdapter;
use Pagerfanta\Pagerfanta;

class OperationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Operation::class);
    }

    public function getList(Member $member, Account $account, int $currentPage = 1, OperationSearchFormModel $formModel = null): Pagerfanta
    {
        $params = [
            ':account_id' => $account->getAccountId(),
        ];

        $sql = <<<'EOT'
                    SELECT
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
                    FROM operation
                    INNER JOIN account ON operation.account_id = account.account_id
                    LEFT JOIN scheduler ON operation.scheduler_id = scheduler.scheduler_id
                    LEFT JOIN account AS transfer_account ON operation.transfer_account_id = transfer_account.account_id
                    LEFT JOIN operation AS transfer_operation ON operation.transfer_operation_id = transfer_operation.operation_id
                    LEFT JOIN category ON operation.category_id = category.category_id
                    LEFT JOIN payment_method ON operation.payment_method_id = payment_method.payment_method_id
                    WHERE operation.account_id = :account_id
            EOT;
        if (null !== $formModel) {
            if ('' !== $formModel->thirdParty) {
                $sql .= ' AND operation.third_party ILIKE :third_party';
                $params[':third_party'] = '%'.$formModel->thirdParty.'%';
            }

            if (null !== $formModel->categories && 0 !== count($formModel->categories)) {
                $categories = array_map(
                    function (Category $value) {
                        return $value->getCategoryId();
                    },
                    $formModel->categories
                );

                $sql .= ' AND operation.category_id IN ('.implode(',', $categories).')';
            }
            if (null !== $formModel->paymentMethods && 0 !== count($formModel->paymentMethods)) {
                $paymentMethods = array_map(
                    function (PaymentMethod $value) {
                        return $value->getPaymentMethodId();
                    },
                    $formModel->paymentMethods
                );

                $sql .= ' AND operation.payment_method_id IN ('.implode(',', $paymentMethods).')';
            }

            for ($i = 1; $i <= 2; ++$i) {
                if (null === $formModel->{'amount'.$i}) {
                    break;
                }

                switch ($formModel->{'amountComparator'.$i}) {
                    case 'inferiorTo':
                        $sql .= ' AND operation.'.$formModel->type.' < :amount'.$i;
                        $params[':amount'.$i] = $formModel->{'amount'.$i};

                        break;
                    case 'inferiorOrEqualTo':
                        $sql .= ' AND operation.'.$formModel->type.' <= :amount'.$i;
                        $params[':amount'.$i] = $formModel->{'amount'.$i};

                        break;
                    case 'equalTo':
                        $sql .= ' AND operation.'.$formModel->type.' = :amount'.$i;
                        $params[':amount'.$i] = $formModel->{'amount'.$i};

                        break;
                    case 'superiorOrEqualTo':
                        $sql .= ' AND operation.'.$formModel->type.' >= :amount'.$i;
                        $params[':amount'.$i] = $formModel->{'amount'.$i};

                        break;
                    case 'superiorTo':
                        $sql .= ' AND operation.'.$formModel->type.' > :amount'.$i;
                        $params[':amount'.$i] = $formModel->{'amount'.$i};

                        break;
                }
            }

            if (null !== $formModel->valueDateStart) {
                $sql .= ' AND operation.value_date >= :value_date_start';
                $params[':value_date_start'] = $formModel->valueDateStart->format(\DateTime::ISO8601);
            }
            if (null !== $formModel->valueDateEnd) {
                $sql .= ' AND operation.value_date <= :value_date_end';
                $params[':value_date_end'] = $formModel->valueDateEnd->format(\DateTime::ISO8601);
            }
            if (null !== $formModel->notes) {
                $sql .= ' AND operation.notes ILIKE :notes';
                $params[':notes'] = '%'.$formModel->notes.'%';
            }
            if (null !== $formModel->reconciled) {
                $sql .= ' AND operation.is_reconciled = :reconciled';
                $params[':reconciled'] = $formModel->reconciled ? 'true' : 'false';
            }
        }

        $sql .= ' ORDER BY operation.value_date DESC, operation.created_at DESC';

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
            $sql .= ' LIMIT :length OFFSET :offset';

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
                        'amount' => (null !== $row['operation_credit']) ? $row['operation_credit'] : -$row['operation_debit'],
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
        $sql = <<<'EOT'
                    SELECT o2.third_party AS "thirdParty", o2.category_id AS "categoryId"
                    FROM (
                        SELECT o.third_party, MAX(o.value_date) AS max_value_date
                        FROM operation o
                        INNER JOIN account a ON o.account_id = a.account_id
                        INNER JOIN bank b ON a.bank_id = b.bank_id
                        WHERE b.member_id = :member_id
                        AND o.third_party ILIKE :third_party
                        GROUP BY o.third_party
                    ) AS tmp
                    INNER JOIN operation o2 ON o2.third_party = tmp.third_party AND o2.value_date = tmp.max_value_date
                    GROUP BY o2.third_party, o2.category_id
            EOT;
        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);
        $stmt->bindValue('member_id', $member->getMemberId());
        $stmt->bindValue('third_party', '%'.$queryString.'%');
        $stmt->execute();

        return $stmt->fetchAll();
    }

    public function getLastFromCategory(Member $member, Category $category): ?Operation
    {
        $dql = <<<'EOT'
                    SELECT o
                    FROM App:Operation o
                    JOIN o.account a
                    JOIN a.bank b
                    WHERE b.member = :member
                    AND o.category = :category
                    AND b.deleted = false
                    AND b.closed = false
                    AND a.deleted = false
                    AND a.closed = false
                    ORDER BY o.valueDate DESC
            EOT;
        $query = $this->getEntityManager()->createQuery($dql)->setMaxResults(1);
        $query->setParameter('member', $member);
        $query->setParameter('category', $category);

        return $query->getOneOrNullResult();
    }

    public function getLastBiggestExpense(Member $member, \DateTime $since): ?Operation
    {
        $dql = <<<'EOT'
                    SELECT o
                    FROM App:Operation o
                    WHERE o.debit = (
                      SELECT MAX(o2.debit)
                      FROM App:Operation o2
                      JOIN o2.account a
                      JOIN a.bank b
                      WHERE b.member = :member
                      AND o2.debit > 0
                      AND o2.scheduler IS NULL
                      AND o2.valueDate >= :valueDate
                      AND b.deleted = false
                      AND b.closed = false
                      AND a.deleted = false
                      AND a.closed = false
                    )
            EOT;
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setMaxResults(1);
        $query->setParameter('member', $member);
        $query->setParameter('valueDate', $since->format(\DateTime::ISO8601));

        return $query->getOneOrNullResult();
    }

    public function getLastExternalOperationId(Account $account): ?string
    {
        $dql = <<<'EOT'
                    SELECT o.externalOperationId
                    FROM App:Operation o
                    WHERE o.account = :account
                    ORDER BY o.externalOperationId DESC
            EOT;
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('account', $account);
        $query->setMaxResults(1);

        try {
            return $query->getSingleScalarResult();
        } catch (NoResultException $e) {
            return null;
        }
    }

    /**
     * Gets total amount by month.
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
        foreach ($accounts as $k => $account) {
            $accountsId[':account_id_'.$k] = $account->getAccountId();
        }

        $sql .= ' WHERE o.account_id IN ('.implode(', ', array_keys($accountsId)).')';
        if (null !== $report->getValueDateStart()) {
            $sql .= ' AND o.value_date >= :value_date_start';
        }
        if (null !== $report->getValueDateEnd()) {
            $sql .= ' AND o.value_date <= :value_date_end';
        }
        if (null !== $report->getThirdParties()) {
            $sql .= ' AND o.third_party ILIKE :third_parties';
        }
        if ($report->getReconciledOnly()) {
            $sql .= ' AND o.is_reconciled = true';
        }
        if ('' !== $groupingData) {
            $sql .= ' GROUP BY grouping_data';
            $sql .= ' ORDER BY grouping_data ASC';
        }

        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);

        array_walk($accountsId, function ($accountId, $k) use ($stmt): void {
            $stmt->bindValue(ltrim($k, ':'), $accountId);
        });

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
        $dql = <<<'EOT'
                    SELECT o.valueDate
                    FROM App:Operation o
                    WHERE o.scheduler = :scheduler
                    AND o.valueDate >= :valueDate
                    ORDER BY o.valueDate DESC
            EOT;
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setMaxResults(1);
        $query->setParameter('scheduler', $scheduler);
        $query->setParameter('valueDate', $scheduler->getValueDate()->format(\DateTime::ISO8601));

        return $query->getResult();
    }

    /**
     * Gets operations sum for each month.
     */
    protected function getSumsByMonth(Member $member, \DateTime $startDate, \DateTime $endDate, Account $account = null): array
    {
        $data = [];

        $sql = <<<'EOT'
                    SELECT a.currency, TO_CHAR(o.value_date, 'YYYY-MM') AS month, (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS total
                    FROM account a
                    LEFT JOIN operation o ON o.account_id = a.account_id
                    LEFT JOIN bank b ON b.bank_id = a.bank_id
                    WHERE b.member_id = :member_id
                    AND a.is_deleted = false
                    AND b.is_deleted = false
                    AND TO_CHAR(o.value_date, 'YYYY-MM-DD') >= :start_date
                    AND TO_CHAR(o.value_date, 'YYYY-MM-DD') <= :end_date
            EOT;
        if (null !== $account) {
            $sql .= ' AND a.account_id = :account_id';
        }

        $sql .= ' GROUP BY a.currency, month';
        $sql .= ' ORDER BY month ASC';

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
     */
    protected function getSumBefore(Member $member, \DateTime $endDate, Account $account = null): array
    {
        $data = [];

        $sql = <<<'EOT'
                    SELECT a.currency, (COALESCE(SUM(o.credit), 0) - COALESCE(SUM(o.debit), 0)) AS total
                    FROM account a
                    LEFT JOIN operation o ON o.account_id = a.account_id
                    LEFT JOIN bank b ON b.bank_id = a.bank_id
                    WHERE b.member_id = :member_id
                    AND a.is_deleted = false
                    AND b.is_deleted = false
                    AND TO_CHAR(o.value_date, 'YYYY-MM-DD') < :end_date
            EOT;
        if (null !== $account) {
            $sql .= ' AND a.account_id = :account_id';
        }

        $sql .= ' GROUP BY a.currency';

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
