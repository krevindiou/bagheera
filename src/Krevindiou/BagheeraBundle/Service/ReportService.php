<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Bridge\Monolog\Logger;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\User;
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
     * @param  User                                   $user User entity
     * @return Doctrine\Common\Collections\Collection
     */
    public function getList(User $user)
    {
        return $user->getReports();
    }

    /**
     * Returns reports list displayed on homepage
     *
     * @param  User  $user User entity
     * @return array
     */
    public function getHomepageList(User $user)
    {
        $dql = 'SELECT r FROM KrevindiouBagheeraBundle:Report r ';
        $dql.= 'WHERE r.user = :user ';
        $dql.= 'AND r.homepage = :homepage ';

        $query = $this->em->createQuery($dql);
        $query->setParameter('user', $user);
        $query->setParameter('homepage', true);

        return $query->getResult();
    }

    /**
     * Returns report form
     *
     * @param  User   $user   User entity
     * @param  Report $report Report entity
     * @param  string $type   Report type (sum, average, distribution, estimate)
     * @return Form
     */
    public function getForm(User $user, Report $report = null, $type = null)
    {
        if (null === $report) {
            $report = new Report();
            $report->setUser($user);
            $report->setType($type);
        } elseif ($user !== $report->getUser()) {
            return;
        }

        return $this->formFactory->create('report_type', $report);
    }

    /**
     * Saves report
     *
     * @param  User    $user   User entity
     * @param  Report  $report Report entity
     * @return boolean
     */
    protected function _save(User $user, Report $report)
    {
        if ($user === $report->getUser()) {
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
     * @param  User    $user   User entity
     * @param  Report  $report Report entity
     * @return boolean
     */
    public function save(User $user, Report $report)
    {
        $errors = $this->validator->validate($report);

        if (0 == count($errors)) {
            return $this->_save($user, $report);
        }

        return false;
    }

    /**
     * Saves report form
     *
     * @param  User    $user User entity
     * @param  Form    $form Report form
     * @return boolean
     */
    public function saveForm(User $user, Form $form)
    {
        if ($form->isValid()) {
            return $this->_save($user, $form->getData());
        }

        return false;
    }

    /**
     * Deletes reports
     *
     * @param  User    $user      User entity
     * @param  array   $reportsId Reports id to delete
     * @return boolean
     */
    public function delete(User $user, array $reportsId)
    {
        try {
            foreach ($reportsId as $reportId) {
                $report = $this->em->find('KrevindiouBagheeraBundle:Report', $reportId);

                if (null !== $report) {
                    if ($user === $report->getUser()) {
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
     * @param  User   $user   User entity
     * @param  Report $report Report entity
     * @return array
     */
    public function getGraphData(User $user, Report $report)
    {
        $series = array(
            array(
                'label' => 'operation_type_credit',
                'color' => '#4bb2c5'
            ),
            array(
                'label' => 'operation_type_debit',
                'color' => '#eaa228'
            )
        );

        if ($user === $report->getUser()) {
            $accounts = $report->getAccounts()->toArray();
            if (count($accounts) == 0) {
                $dql = 'SELECT a FROM KrevindiouBagheeraBundle:Account a ';
                $dql.= 'JOIN a.bank b ';
                $dql.= 'WHERE b.user = :user ';
                $dql.= 'AND b.isDeleted = 0 ';
                $dql.= 'AND a.isDeleted = 0 ';

                $query = $this->em->createQuery($dql);
                $query->setParameter('user', $user);

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
                    $series[0]['points'][strtotime($result['grouping_data'])] = round($result['data_1'], 2);
                    $series[1]['points'][strtotime($result['grouping_data'])] = round($result['data_2'], 2);
                } else {
                    $series[0]['points'][strtotime(date('Y-01-01'))] = round($result['data_1'], 2);
                    $series[1]['points'][strtotime(date('Y-01-01'))] = round($result['data_2'], 2);
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

                            if (!isset($serie['points'][strtotime($date->format('Y-m-d'))])) {
                                $series[$k]['points'][strtotime($date->format('Y-m-d'))] = 0;
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
     * @param  User     $user      User entity
     * @param  DateTime $startDate Data after this date
     * @param  DateTime $stopDate  Data before this date
     * @param  Account  $account   Synthesis for specific account
     * @return array
     */
    public function getSynthesis(User $user, \DateTime $startDate = null, \DateTime $stopDate = null, Account $account = null)
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

        $data = $operationRepository->getTotalByMonth($user, $startDate, $stopDate, $account);

        if (!empty($data)) {
            $tmpValues = array();
            foreach ($data as $currency => $values) {
                foreach ($values as $month => $value) {
                    $graph['points'][$currency][strtotime($month . '-01')] = $value;
                }

                $tmpValues = array_merge(array_values($tmpValues), array_values($values));
            }

            $yaxisMin = (int) (min($tmpValues) * 0.95);
            $yaxisMax = (int) (max($tmpValues) * 1.05);

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
