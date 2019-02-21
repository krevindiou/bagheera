<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\Member;
use App\Entity\Report;
use App\Form\Type\ReportFormType;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class ReportService
{
    private $logger;
    private $em;
    private $formFactory;
    private $validator;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
    }

    /**
     * Returns reports list.
     */
    public function getList(Member $member): ArrayCollection
    {
        return $this->em->getRepository('App:Report')->getList($member);
    }

    /**
     * Returns reports list displayed on homepage.
     */
    public function getHomepageList(Member $member): ArrayCollection
    {
        return $this->em->getRepository('App:Report')->getHomepageList($member);
    }

    /**
     * Returns report form.
     *
     * @param Member $member Member entity
     * @param Report $report Report entity
     * @param string $type   Report type (sum, average, distribution, estimate)
     */
    public function getForm(Member $member, Report $report = null, string $type = null): ?Form
    {
        if (null === $report && null === $type) {
            return null;
        }

        if (null === $report) {
            $report = new Report();
            $report->setMember($member);
            $report->setType($type);
        } elseif ($member !== $report->getMember()) {
            return null;
        }

        return $this->formFactory->create(ReportFormType::class, $report);
    }

    /**
     * Saves report.
     */
    public function save(Member $member, Report $report): bool
    {
        $errors = $this->validator->validate($report);

        if (0 === count($errors)) {
            return $this->doSave($member, $report);
        }

        return false;
    }

    /**
     * Saves report form.
     */
    public function saveForm(Member $member, Form $form): bool
    {
        if ($form->isValid()) {
            return $this->doSave($member, $form->getData());
        }

        return false;
    }

    /**
     * Deletes reports.
     */
    public function delete(Member $member, array $reportsId): bool
    {
        try {
            foreach ($reportsId as $reportId) {
                $report = $this->em->find('App:Report', $reportId);

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
     * Returns graph data.
     */
    public function getGraphData(Member $member, Report $report): array
    {
        $series = [
            [
                'label' => 'operation.type_credit',
                'color' => '#94ba65',
            ],
            [
                'label' => 'operation.type_debit',
                'color' => '#2b4e72',
            ],
        ];

        if ($member === $report->getMember()) {
            $accounts = $report->getAccounts()->toArray();
            if (0 === count($accounts)) {
                $accounts = $this->em->getRepository('App:Account')->getList($member, null, false);
            }

            if (in_array($report->getType(), ['sum', 'average'], true)) {
                $results = $this->getGraphValues($report, $accounts, $report->getType());
            } elseif ('distribution' === $report->getType()) {
                /** @todo */
                $results = [];
            } elseif ('estimate' === $report->getType()) {
                /** @todo */
                $results = [];
            }

            foreach ($results as $result) {
                if (isset($result['grouping_data'])) {
                    $series[0]['points'][strtotime($result['grouping_data'].' UTC')] = round($result['data_1'], 2);
                    $series[1]['points'][strtotime($result['grouping_data'].' UTC')] = round($result['data_2'], 2);
                } else {
                    $series[0]['points'][strtotime(date('Y-01-01').' UTC')] = round($result['data_1'], 2);
                    $series[1]['points'][strtotime(date('Y-01-01').' UTC')] = round($result['data_2'], 2);
                }
            }

            foreach ($series as $k => $serie) {
                if (!empty($serie['points'])) {
                    switch ($report->getPeriodGrouping()) {
                        case 'month':
                            $interval = 'P1M';

                            break;
                        case 'quarter':
                            $interval = 'P3M';

                            break;
                        case 'year':
                            $interval = 'P1Y';

                            break;
                        default:
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

                            if (!isset($serie['points'][strtotime($date->format('Y-m-d').' UTC')])) {
                                $series[$k]['points'][strtotime($date->format('Y-m-d').' UTC')] = 0;
                            }
                        }
                    }

                    ksort($series[$k]['points']);
                }
            }
        }

        $yaxisMin = (int) (min(array_merge($series[0]['points'], $series[1]['points'])) * 0.95);
        $yaxisMax = (int) (max(array_merge($series[0]['points'], $series[1]['points'])) * 1.05);

        $tmp = 10 ** (strlen((string) $yaxisMin) - 2);
        $yaxisMin = floor($yaxisMin / $tmp) * $tmp;

        $tmp = 10 ** (strlen((string) $yaxisMax) - 2);
        $yaxisMax = ceil($yaxisMax / $tmp) * $tmp;

        return [
            'report' => $report,
            'series' => $series,
            'yaxisMin' => $yaxisMin,
            'yaxisMax' => $yaxisMax,
        ];
    }

    /**
     * Returns graph data.
     *
     * @param Report $report   Report entity
     * @param array  $accounts Accounts list
     * @param string $type     sum or average
     */
    public function getGraphValues(Report $report, array $accounts, string $type): array
    {
        return $this->em->getRepository('App:Operation')->getGraphValues($report, $accounts, $type);
    }

    /**
     * Returns synthesis graph data.
     *
     * @param Member    $member    Member entity
     * @param \DateTime $startDate Data after this date
     * @param \DateTime $endDate   Data before this date
     * @param Account   $account   Synthesis for specific account
     */
    public function getSynthesis(Member $member, \DateTime $startDate = null, \DateTime $endDate = null, Account $account = null): array
    {
        $graph = [];

        if (null === $endDate) {
            $endDate = new \DateTime();
        }

        if (null === $startDate) {
            $startDate = clone $endDate;
            $startDate->modify('First day of -11 months');
        }

        $operationRepository = $this->em->getRepository('App:Operation');

        $data = $operationRepository->getTotalByMonth($member, $startDate, $endDate, $account);

        if (!empty($data)) {
            $tmpValues = [];
            foreach ($data as $currency => $values) {
                foreach ($values as $month => $value) {
                    $graph['points'][$currency][strtotime($month.'-01 UTC')] = $value;
                }

                $tmpValues = array_merge(array_values($tmpValues), array_values($values));
            }

            $diff = (int) (max($tmpValues) - min($tmpValues));

            $yaxisMin = (int) (min($tmpValues) - $diff * 0.05);
            $yaxisMax = (int) (max($tmpValues) + $diff * 0.05);

            $tmp = 10 ** (strlen((string) abs($yaxisMin)) - 2);
            $yaxisMin = floor($yaxisMin / $tmp) * $tmp;

            $tmp = 10 ** (strlen((string) $yaxisMax) - 2);
            $yaxisMax = ceil($yaxisMax / $tmp) * $tmp;

            $graph['yaxisMin'] = $yaxisMin;
            $graph['yaxisMax'] = $yaxisMax;
        }

        return $graph;
    }

    /**
     * Saves report.
     */
    protected function doSave(Member $member, Report $report): bool
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
}
