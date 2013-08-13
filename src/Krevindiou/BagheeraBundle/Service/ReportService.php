<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Bridge\Monolog\Logger;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\Member;
use Krevindiou\BagheeraBundle\Entity\Account;
use Krevindiou\BagheeraBundle\Entity\Report;

/**
 * @DI\Service("bagheera.report")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "report"})
 */
class ReportService
{
    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /**
     * Returns reports list
     *
     * @param  Member $member Member entity
     * @return array
     */
    public function getList(Member $member)
    {
        $reports = array();

        $sql = 'SET SESSION group_concat_max_len = 10000';
        $this->em->getConnection()->exec($sql);

        $sql = 'SELECT
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
            report.estimate_duration_unit AS report_estimate_duration_unit, ';
        $sql.= ' (SELECT
            CONCAT(
                "[",
                GROUP_CONCAT(
                    CONCAT("{\"accountId\": \"", account.account_id, "\""),
                    CONCAT(", \"name\": \"", REPLACE(account.name, "\"", "\\\\\""), "\"}")
                ),
                "]"
            ) ';
        $sql.= '  FROM report_account ';
        $sql.= '  INNER JOIN account ON report_account.account_id = account.account_id ';
        $sql.= '  WHERE report_account.report_id = report.report_id ';
        $sql.= '  GROUP BY report_account.report_id ';
        $sql.= ') AS accounts, ';
        $sql.= ' (SELECT
            CONCAT(
                "[",
                GROUP_CONCAT(
                    CONCAT("{\"categoryId\": \"", category.category_id, "\""),
                    CONCAT(", \"name\": \"", REPLACE(category.name, "\"", "\\\\\""), "\"}")
                ),
                "]"
            ) ';
        $sql.= '  FROM report_category ';
        $sql.= '  INNER JOIN category ON report_category.category_id = category.category_id ';
        $sql.= '  WHERE report_category.report_id = report.report_id ';
        $sql.= '  GROUP BY report_category.report_id ';
        $sql.= ') AS categories, ';
        $sql.= ' (SELECT
            CONCAT(
                "[",
                GROUP_CONCAT(
                    CONCAT("{\"paymentMethodId\": \"", payment_method.payment_method_id, "\""),
                    CONCAT(", \"name\": \"", REPLACE(payment_method.name, "\"", "\\\\\""), "\"}")
                ),
                "]"
            ) ';
        $sql.= '  FROM report_payment_method ';
        $sql.= '  INNER JOIN payment_method ON report_payment_method.payment_method_id = payment_method.payment_method_id ';
        $sql.= '  WHERE report_payment_method.report_id = report.report_id ';
        $sql.= '  GROUP BY report_payment_method.report_id ';
        $sql.= ') AS paymentMethods ';
        $sql.= 'FROM report ';
        $sql.= 'WHERE report.member_id = :member_id ';
        $sql.= 'ORDER BY report.report_id ASC ';

        $stmt = $this->em->getConnection()->prepare($sql);
        $stmt->execute(
            array(
                ':member_id' => $member->getMemberId()
            )
        );

        foreach ($stmt->fetchAll() as $row) {
            if (!isset($reports[$row['report_id']])) {
                $reports[$row['report_id']] = array(
                    'reportId' => $row['report_id'],
                    'title' => $row['report_title'],
                    'type' => $row['report_type'],
                    'title' => $row['report_title'],
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
                    'accounts' => (null !== $row['accounts']) ? json_decode($row['accounts'], true) : array(),
                    'categories' => (null !== $row['categories']) ? json_decode($row['categories'], true) : array(),
                    'paymentMethods' => (null !== $row['paymentMethods']) ? json_decode($row['paymentMethods'], true) : array(),
                );
            }
        }

        return $reports;
    }

    /**
     * Returns reports list displayed on homepage
     *
     * @param  Member $member Member entity
     * @return array
     */
    public function getHomepageList(Member $member)
    {
        $dql = 'SELECT r FROM KrevindiouBagheeraBundle:Report r ';
        $dql.= 'WHERE r.member = :member ';
        $dql.= 'AND r.homepage = :homepage ';

        $query = $this->em->createQuery($dql);
        $query->setParameter('member', $member);
        $query->setParameter('homepage', true);

        return $query->getResult();
    }

    /**
     * Returns report form
     *
     * @param  Member $member Member entity
     * @param  Report $report Report entity
     * @param  string $type   Report type (sum, average, distribution, estimate)
     * @return Form
     */
    public function getForm(Member $member, Report $report = null, $type = null)
    {
        if (null === $report) {
            $report = new Report();
            $report->setMember($member);
            $report->setType($type);
        } elseif ($member !== $report->getMember()) {
            return;
        }

        return $this->formFactory->create('report_type', $report);
    }

    /**
     * Saves report
     *
     * @param  Member $member Member entity
     * @param  Report $report Report entity
     * @return boolean
     */
    protected function doSave(Member $member, Report $report)
    {
        if ($member === $report->getMember()) {
            try {
                $this->em->persist($report);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Saves report
     *
     * @param  Member $member Member entity
     * @param  Report $report Report entity
     * @return boolean
     */
    public function save(Member $member, Report $report)
    {
        $errors = $this->validator->validate($report);

        if (0 == count($errors)) {
            return $this->doSave($member, $report);
        }

        return false;
    }

    /**
     * Saves report form
     *
     * @param  Member $member Member entity
     * @param  Form   $form Report form
     * @return boolean
     */
    public function saveForm(Member $member, Form $form)
    {
        if ($form->isValid()) {
            return $this->doSave($member, $form->getData());
        }

        return false;
    }

    /**
     * Deletes reports
     *
     * @param  Member $member    Member entity
     * @param  array  $reportsId Reports id to delete
     * @return boolean
     */
    public function delete(Member $member, array $reportsId)
    {
        try {
            foreach ($reportsId as $reportId) {
                $report = $this->em->find('KrevindiouBagheeraBundle:Report', $reportId);

                if (null !== $report) {
                    if ($member === $report->getMember()) {
                        $this->em->remove($report);
                    }
                }
            }

            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Returns graph data
     *
     * @param  Member $member Member entity
     * @param  Report $report Report entity
     * @return array
     */
    public function getGraphData(Member $member, Report $report)
    {
        $series = array(
            array(
                'label' => 'operation.type_credit',
                'color' => '#94ba65'
            ),
            array(
                'label' => 'operation.type_debit',
                'color' => '#2b4e72'
            )
        );

        if ($member === $report->getMember()) {
            $accounts = $report->getAccounts()->toArray();
            if (count($accounts) == 0) {
                $dql = 'SELECT a FROM KrevindiouBagheeraBundle:Account a ';
                $dql.= 'JOIN a.bank b ';
                $dql.= 'AND b.deleted = 0 ';
                $dql.= 'AND a.deleted = 0 ';
                $dql.= 'WHERE b.member = :member ';

                $query = $this->em->createQuery($dql);
                $query->setParameter('member', $member);

                $accounts = $query->getResult();
            }

            if (in_array($report->getType(), array('sum', 'average'))) {
                $results = $this->getGraphValues($report, $accounts, $report->getType());
            } elseif ('distribution' == $report->getType()) {
                // @todo
                $results = array();
            } elseif ('estimate' == $report->getType()) {
                // @todo
                $results = array();
            }

            foreach ($results as $result) {
                if (isset($result['grouping_data'])) {
                    $series[0]['points'][strtotime($result['grouping_data'] . ' UTC')] = round($result['data_1'], 2);
                    $series[1]['points'][strtotime($result['grouping_data'] . ' UTC')] = round($result['data_2'], 2);
                } else {
                    $series[0]['points'][strtotime(date('Y-01-01') . ' UTC')] = round($result['data_1'], 2);
                    $series[1]['points'][strtotime(date('Y-01-01') . ' UTC')] = round($result['data_2'], 2);
                }
            }

            foreach ($series as $k => $serie) {
                if (!empty($serie['points'])) {
                    switch ($report->getPeriodGrouping()) {
                        case 'month' :
                            $interval = 'P1M';
                            break;

                        case 'quarter' :
                            $interval = 'P3M';
                            break;

                        case 'year' :
                            $interval = 'P1Y';
                            break;

                        default :
                            $interval = 'P1Y';
                    }

                    if (null !== $interval) {
                        $firstDate = new \DateTime();
                        $firstDate->setTimestamp(key($serie['points']));

                        end($serie['points']);

                        $lastDate = new \DateTime();
                        $lastDate->setTimestamp(key($serie['points']));

                        // Sets 0 for non existent values
                        $date = clone $firstDate;
                        while ($date < $lastDate) {
                            $date->add(new \DateInterval($interval));

                            if (!isset($serie['points'][strtotime($date->format('Y-m-d') . ' UTC')])) {
                                $series[$k]['points'][strtotime($date->format('Y-m-d') . ' UTC')] = 0;
                            }
                        }
                    }

                    ksort($series[$k]['points']);
                }
            }
        }

        $yaxisMin = (int) (min(array_merge($series[0]['points'], $series[1]['points'])) * 0.95);
        $yaxisMax = (int) (max(array_merge($series[0]['points'], $series[1]['points'])) * 1.05);

        $tmp = pow(10, (strlen($yaxisMin) - 2));
        $yaxisMin = floor($yaxisMin / $tmp) * $tmp;

        $tmp = pow(10, (strlen($yaxisMax) - 2));
        $yaxisMax = ceil($yaxisMax / $tmp) * $tmp;

        return array(
            'report' => $report,
            'series' => $series,
            'yaxisMin' => $yaxisMin,
            'yaxisMax' => $yaxisMax
        );
    }

    /**
     * Returns graph data
     *
     * @param  Report $report   Report entity
     * @param  array  $accounts Accounts list
     * @param  string $type     sum or average
     * @return array
     */
    public function getGraphValues(Report $report, array $accounts, $type)
    {
        switch ($report->getPeriodGrouping()) {
            case 'month' :
                $groupingData = 'DATE_FORMAT(o.value_date, \'%Y-%m-01\')';
                break;

            case 'quarter' :
                $groupingData = 'CONCAT(DATE_FORMAT(o.value_date, \'%Y-\'), LPAD(FLOOR((DATE_FORMAT(o.value_date, \'%c\') - 1) / 3) * 3 + 1, 2, \'0\'), \'-01\')';
                break;

            case 'year' :
                $groupingData = 'DATE_FORMAT(o.value_date, \'%Y-01-01\')';
                break;

            default :
                $groupingData = '';
        }

        $sql = 'SELECT ' . (('' != $groupingData) ? $groupingData . ' AS grouping_data, ' : '');
        $sql.= (('average' == $type) ? 'AVG' : 'SUM') . '(o.credit) AS data_1, ' . (('average' == $type) ? 'AVG' : 'SUM') . '(o.debit) AS data_2 ';
        $sql.= 'FROM operation AS o ';

        $accountsId = array();
        foreach ($accounts as $account) {
            $accountsId[] = $account->getAccountId();
        }

        $sql.= 'WHERE o.account_id IN (' . implode(', ', $accountsId) . ') ';
        if (null !== $report->getValueDateStart()) {
            $sql.= 'AND o.value_date >= :value_date_start ';
        }
        if (null !== $report->getValueDateEnd()) {
            $sql.= 'AND o.value_date <= :value_date_end ';
        }
        if (null !== $report->getThirdParties()) {
            $sql.= 'AND o.third_party LIKE :third_parties ';
        }
        if ($report->getReconciledOnly()) {
            $sql.= 'AND o.is_reconciled = 1 ';
        }
        if ('' != $groupingData) {
            $sql.= 'GROUP BY grouping_data ';
            $sql.= 'ORDER BY grouping_data ASC ';
        }

        $stmt = $this->em->getConnection()->prepare($sql);
        if (null !== $report->getValueDateStart()) {
            $stmt->bindValue('value_date_start', $report->getValueDateStart()->format(\DateTime::ISO8601));
        }
        if (null !== $report->getValueDateEnd()) {
            $stmt->bindValue('value_date_end', $report->getValueDateEnd()->format(\DateTime::ISO8601));
        }
        if (null !== $report->getThirdParties()) {
            $stmt->bindValue('third_parties', '%' . $report->getThirdParties() . '%');
        }

        $stmt->execute();

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Returns synthesis graph data
     *
     * @param  Member   $member    Member entity
     * @param  DateTime $startDate Data after this date
     * @param  DateTime $stopDate  Data before this date
     * @param  Account  $account   Synthesis for specific account
     * @return array
     */
    public function getSynthesis(Member $member, \DateTime $startDate = null, \DateTime $stopDate = null, Account $account = null)
    {
        $graph = array();

        if (null === $stopDate) {
            $stopDate = new \DateTime();
        }

        if (null === $startDate) {
            $startDate = clone $stopDate;
            $startDate->modify('First day of -11 months');
        }

        $operationRepository = $this->em->getRepository('KrevindiouBagheeraBundle:Operation');

        $data = $operationRepository->getTotalByMonth($member, $startDate, $stopDate, $account);

        if (!empty($data)) {
            $tmpValues = array();
            foreach ($data as $currency => $values) {
                foreach ($values as $month => $value) {
                    $graph['points'][$currency][strtotime($month . '-01 UTC')] = $value;
                }

                $tmpValues = array_merge(array_values($tmpValues), array_values($values));
            }

            $diff = (int) (max($tmpValues) - min($tmpValues));

            $yaxisMin = (int) (min($tmpValues) - $diff * 0.05);
            $yaxisMax = (int) (max($tmpValues) + $diff * 0.05);

            $tmp = pow(10, (strlen(abs($yaxisMin)) - 2));
            $yaxisMin = floor($yaxisMin / $tmp) * $tmp;

            $tmp = pow(10, (strlen($yaxisMax) - 2));
            $yaxisMax = ceil($yaxisMax / $tmp) * $tmp;

            $graph['yaxisMin'] = $yaxisMin;
            $graph['yaxisMax'] = $yaxisMax;
        }

        return $graph;
    }
}
