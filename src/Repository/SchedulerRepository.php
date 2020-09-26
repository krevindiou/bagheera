<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Account;
use App\Entity\Scheduler;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Pagerfanta\Adapter\CallbackAdapter;
use Pagerfanta\Pagerfanta;
use Doctrine\Persistence\ManagerRegistry;

class SchedulerRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Scheduler::class);
    }

    public function getList(Account $account, int $currentPage = 1): Pagerfanta
    {
        $params = [
            ':account_id' => $account->getAccountId(),
        ];

        $sql =<<<'EOT'
        SELECT
            scheduler.scheduler_id AS scheduler_id,
            scheduler.third_party AS scheduler_third_party,
            scheduler.debit AS scheduler_debit,
            scheduler.credit AS scheduler_credit,
            scheduler.value_date AS scheduler_value_date,
            scheduler.limit_date AS scheduler_limit_date,
            scheduler.is_reconciled AS scheduler_is_reconciled,
            scheduler.notes AS scheduler_notes,
            scheduler.frequency_unit AS scheduler_frequency_unit,
            scheduler.frequency_value AS scheduler_frequency_value,
            scheduler.is_active AS scheduler_is_active,
            account.account_id AS account_id,
            account.name AS account_name,
            account.currency AS account_currency,
            transfer_account.account_id AS transfer_account_id,
            transfer_account.name AS transfer_account_name,
            category.category_id AS category_id,
            category.name AS category_name,
            payment_method.payment_method_id AS payment_method_id,
            payment_method.name AS payment_method_name
        FROM scheduler
        INNER JOIN account ON scheduler.account_id = account.account_id
        LEFT JOIN account AS transfer_account ON scheduler.transfer_account_id = transfer_account.account_id
        LEFT JOIN category ON scheduler.category_id = category.category_id
        LEFT JOIN payment_method ON scheduler.payment_method_id = payment_method.payment_method_id
        WHERE scheduler.account_id = :account_id
        ORDER BY scheduler.created_at DESC
EOT;
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

            $schedulers = [];

            foreach ($stmt->fetchAll() as $row) {
                if (!isset($schedulers[$row['scheduler_id']])) {
                    $schedulers[$row['scheduler_id']] = [
                        'schedulerId' => $row['scheduler_id'],
                        'account' => [
                            'accountId' => $row['account_id'],
                            'currency' => $row['account_currency'],
                            'name' => $row['account_name'],
                        ],
                        'transferAccount' => [
                            'accountId' => $row['transfer_account_id'],
                            'name' => $row['transfer_account_name'],
                        ],
                        'category' => [
                            'categoryId' => $row['category_id'],
                            'name' => $row['category_name'],
                        ],
                        'paymentMethod' => [
                            'paymentMethodId' => $row['payment_method_id'],
                            'name' => $row['payment_method_name'],
                        ],

                        'thirdParty' => $row['scheduler_third_party'],
                        'debit' => $row['scheduler_debit'],
                        'credit' => $row['scheduler_credit'],
                        'amount' => (null !== $row['scheduler_credit']) ? $row['scheduler_credit'] : -$row['scheduler_debit'],
                        'valueDate' => (null !== $row['scheduler_value_date']) ? new \DateTime($row['scheduler_value_date']) : null,
                        'limitDate' => (null !== $row['scheduler_limit_date']) ? new \DateTime($row['scheduler_limit_date']) : null,
                        'reconciled' => $row['scheduler_is_reconciled'],
                        'notes' => $row['scheduler_notes'],
                        'frequencyUnit' => $row['scheduler_frequency_unit'],
                        'frequencyValue' => $row['scheduler_frequency_value'],
                        'active' => $row['scheduler_is_active'],
                    ];
                }
            }

            return $schedulers;
        };

        $adapter = new CallbackAdapter($getNbResultsCallback, $getSliceCallback);

        $pager = new Pagerfanta($adapter);
        $pager->setMaxPerPage(20);
        $pager->setCurrentPage($currentPage);

        return $pager;
    }
}
