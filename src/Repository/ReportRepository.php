<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Member;
use App\Entity\Report;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Bridge\Doctrine\RegistryInterface;

class ReportRepository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, Report::class);
    }

    public function getList(Member $member): ArrayCollection
    {
        $reports = [];

        $sql =<<<'EOT'
        SELECT
            report.report_id,
            report.type AS report_type,
            report.title AS report_title,
            report.homepage AS report_homepage,
            report.value_date_start AS report_value_date_start,
            report.value_date_end AS report_value_date_end,
            report.third_parties AS report_third_parties,
            report.reconciled_only AS report_reconciled_only,
            report.period_grouping AS report_period_grouping,
            report.data_grouping AS report_data_grouping,
            report.significant_results_number AS report_significant_results_number,
            report.month_expenses AS report_month_expenses,
            report.month_incomes AS report_month_incomes,
            report.estimate_duration_value AS report_estimate_duration_value,
            report.estimate_duration_unit AS report_estimate_duration_unit,
        array_to_json(array_agg(account)) AS accounts,
        array_to_json(array_agg(category)) AS categories,
        array_to_json(array_agg(payment_method)) AS payment_methods
        FROM report
        LEFT JOIN report_account ON report.report_id = report_account.report_id
        LEFT JOIN account ON report_account.account_id = account.account_id
        LEFT JOIN report_category ON report.report_id = report_category.report_id
        LEFT JOIN category ON report_category.category_id = category.category_id
        LEFT JOIN report_payment_method ON report.report_id = report_payment_method.report_id
        LEFT JOIN payment_method ON report_payment_method.payment_method_id = payment_method.payment_method_id
        WHERE report.member_id = :member_id
        GROUP BY report.report_id
        ORDER BY report.report_id ASC
EOT;
        $stmt = $this->getEntityManager()->getConnection()->prepare($sql);
        $stmt->execute(
            [
                ':member_id' => $member->getMemberId(),
            ]
        );

        foreach ($stmt->fetchAll() as $row) {
            if (!isset($reports[$row['report_id']])) {
                $accounts = [];
                $tmpAccounts = (null !== $row['accounts']) ? json_decode($row['accounts'], true) : [];
                foreach ($tmpAccounts as $tmpAccount) {
                    if (null !== $tmpAccount['account_id']) {
                        $accounts[$tmpAccount['account_id']] = [
                            'accountId' => $tmpAccount['account_id'],
                            'name' => $tmpAccount['name'],
                        ];
                    }
                }

                $categories = [];
                $tmpCategories = (null !== $row['categories']) ? json_decode($row['categories'], true) : [];
                foreach ($tmpCategories as $tmpCategory) {
                    if (null !== $tmpCategory['category_id']) {
                        $categories[$tmpCategory['category_id']] = [
                            'categoryId' => $tmpCategory['category_id'],
                            'name' => $tmpCategory['name'],
                        ];
                    }
                }

                $paymentMethods = [];
                $tmpPaymentMethods = (null !== $row['payment_methods']) ? json_decode($row['payment_methods'], true) : [];
                foreach ($tmpPaymentMethods as $tmpPaymentMethod) {
                    if (null !== $tmpPaymentMethod['payment_method_id']) {
                        $paymentMethods[$tmpPaymentMethod['payment_method_id']] = [
                            'paymentMethodId' => $tmpPaymentMethod['payment_method_id'],
                            'name' => $tmpPaymentMethod['name'],
                        ];
                    }
                }

                $reports[$row['report_id']] = [
                    'reportId' => $row['report_id'],
                    'title' => $row['report_title'],
                    'type' => $row['report_type'],
                    'homepage' => $row['report_homepage'],
                    'valueDateStart' => (null !== $row['report_value_date_start']) ? new \DateTime($row['report_value_date_start']) : null,
                    'valueDateEnd' => (null !== $row['report_value_date_end']) ? new \DateTime($row['report_value_date_end']) : null,
                    'thirdParties' => $row['report_third_parties'],
                    'reconciledOnly' => $row['report_reconciled_only'],
                    'periodGrouping' => $row['report_period_grouping'],
                    'dataGrouping' => $row['report_data_grouping'],
                    'significantResultsNumber' => $row['report_significant_results_number'],
                    'monthExpenses' => $row['report_month_expenses'],
                    'monthIncomes' => $row['report_month_incomes'],
                    'estimateDurationValue' => $row['report_estimate_duration_value'],
                    'estimateDurationUnit' => $row['report_estimate_duration_unit'],
                    'accounts' => $accounts,
                    'categories' => $categories,
                    'paymentMethods' => $paymentMethods,
                ];
            }
        }

        return new ArrayCollection($reports);
    }

    public function getHomepageList(Member $member): ArrayCollection
    {
        $dql =<<<'EOT'
        SELECT r FROM App:Report r
        WHERE r.member = :member
        AND r.homepage = :homepage
EOT;
        $query = $this->getEntityManager()->createQuery($dql);
        $query->setParameter('member', $member);
        $query->setParameter('homepage', true);

        return new ArrayCollection($query->getResult());
    }
}
