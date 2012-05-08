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

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Report,
    Krevindiou\BagheeraBundle\Form\ReportForm;

/**
 * Report service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class ReportService
{
    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var FormFactory
     */
    protected $_formFactory;


    public function __construct(Logger $logger, EntityManager $em, FormFactory $formFactory)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
    }

    /**
     * Returns reports list
     *
     * @param  User $user User entity
     * @return Doctrine\Common\Collections\Collection
     */
    public function getList(User $user)
    {
        return $user->getReports();
    }

    /**
     * Returns reports list displayed on homepage
     *
     * @param  User $user User entity
     * @return array
     */
    public function getHomepageList(User $user)
    {
        $dql = 'SELECT r FROM KrevindiouBagheeraBundle:Report r ';
        $dql.= 'WHERE r.user = :user ';
        $dql.= 'AND r.homepage = :homepage ';

        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $user);
        $query->setParameter('homepage', true);

        return $query->getResult();
    }

    /**
     * Returns report form
     *
     * @param  User $user       User entity
     * @param  Report $report   Report entity
     * @param  string $type     Report type (sum, average, distribution, estimate)
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

        $form = $this->_formFactory->create(new ReportForm(), $report);

        return $form;
    }

    /**
     * Saves report
     *
     * @param  User $user     User entity
     * @param  Report $report Report entity
     * @return boolean
     */
    protected function _save(User $user, Report $report)
    {
        if ($user === $report->getUser()) {
            try {
                $this->_em->persist($report);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Saves report
     *
     * @param  User $user     User entity
     * @param  Report $report Report entity
     * @return boolean
     */
    public function save(User $user, Report $report)
    {
        $errors = $this->_validator->validate($report);

        if (0 == count($errors)) {
            return $this->_save($user, $report);
        }

        return false;
    }

    /**
     * Saves report form
     *
     * @param  User $user User entity
     * @param  Form $form Report form
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
     * @param  User $user       User entity
     * @param  array $reportsId Reports id to delete
     * @return boolean
     */
    public function delete(User $user, array $reportsId)
    {
        try {
            foreach ($reportsId as $reportId) {
                $report = $this->_em->find('KrevindiouBagheeraBundle:Report', $reportId);

                if (null !== $report) {
                    if ($user === $report->getUser()) {
                        $this->_em->remove($report);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Returns graph data
     *
     * @param  User $user       User entity
     * @param  Report $report   Report entity
     * @return array
     */
    public function getGraphData(User $user, Report $report)
    {
        $data = array();

        if ($user === $report->getUser()) {
            $accounts = $report->getAccounts()->toArray();
            if (count($accounts) == 0) {
                $dql = 'SELECT a FROM KrevindiouBagheeraBundle:Account a ';
                $dql.= 'JOIN a.bank b ';
                $dql.= 'WHERE b.user = :user ';
                $dql.= 'AND b.isDeleted = 0 ';
                $dql.= 'AND a.isDeleted = 0 ';

                $query = $this->_em->createQuery($dql);
                $query->setParameter('user', $user);

                $accounts = $query->getResult();
            }

            if (in_array($report->getType(), array('sum', 'average'))) {
                $results = $this->_getGraphData($report, $accounts, $report->getType());
            } elseif ('distribution' == $report->getType()) {
                // @todo
                $results = array();
            } elseif ('estimate' == $report->getType()) {
                // @todo
                $results = array();
            }

            foreach ($results as $result) {
                if (isset($result['grouping_data'])) {
                    $data[0][$result['grouping_data']] = sprintf('%.2f', $result['data_1']);
                    $data[1][$result['grouping_data']] = sprintf('%.2f', $result['data_2']);
                } else {
                    $data[0][date('Y-01-01')] = sprintf('%.2f', $result['data_1']);
                    $data[1][date('Y-01-01')] = sprintf('%.2f', $result['data_2']);
                }
            }

            foreach ($data as $k => $item) {
                if (!empty($item)) {
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
                        $firstDate = new \DateTime(key($item));
                        end($item);
                        $lastDate = new \DateTime(key($item));

                        // Sets 0 for non existent values
                        $date = clone $firstDate;
                        while ($date < $lastDate) {
                            $date->add(new \DateInterval($interval));

                            if (!isset($item[$date->format('Y-m-d')])) {
                                $data[$k][$date->format('Y-m-d')] = 0;
                            }
                        }

                        $firstDate->sub(new \DateInterval($interval));
                        $data[$k][$firstDate->format('Y-m-d')] = null;

                        $date->add(new \DateInterval($interval));
                        $data[$k][$date->format('Y-m-d')] = null;
                    }

                    ksort($data[$k]);
                }
            }
        }

        return $data;
    }

    /**
     * Returns graph data
     *
     * @param  Report $report    Report entity
     * @param  array  $accounts  Accounts list
     * @param  string $type      sum or average
     * @return array
     */
    public function _getGraphData(Report $report, array $accounts, $type)
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
        $sql.= 'WHERE o.account_id IN (:accounts_id) ';
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

        $stmt = $this->_em->getConnection()->prepare($sql);
        if (null !== $report->getValueDateStart()) {
            $stmt->bindValue('value_date_start', $report->getValueDateStart()->format(\DateTime::ISO8601));
        }
        if (null !== $report->getValueDateEnd()) {
            $stmt->bindValue('value_date_end', $report->getValueDateEnd()->format(\DateTime::ISO8601));
        }
        if (null !== $report->getThirdParties()) {
            $stmt->bindValue('third_parties', '%' . $report->getThirdParties() . '%');
        }

        $accountsId = array();
        foreach ($accounts as $account) {
            $accountsId[] = $account->getAccountId();
        }
        $stmt->bindValue('accounts_id', implode(', ', $accountsId));

        $stmt->execute();

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
