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

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller,
    Symfony\Component\HttpFoundation\Request,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Method,
    Krevindiou\BagheeraBundle\Entity\Report;

class ReportController extends Controller
{
    /**
     * @Route("/reports", name="report_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $reports = $this->get('bagheera.report')->getList($user);

        return array(
            'reports' => $reports,
        );
    }

    /**
     * @Route("/reports")
     * @Method("POST")
     */
    public function listActionsAction(Request $request)
    {
        $reportsId = (array)$request->request->get('reportsId');

        $user = $this->get('security.context')->getToken()->getUser();

        if ($request->request->get('delete')) {
            $this->get('bagheera.report')->delete($user, $reportsId);
            $this->get('session')->setFlash('notice', 'report_delete_confirmation');
        }

        return $this->redirect($this->generateUrl('report_list'));
    }

    /**
     * @Route("/edit-report-{reportId}", requirements={"reportId" = "\d+"}, name="report_edit")
     * @Route("/new-{type}-report", requirements={"type" = "sum|average|distribution|estimate"}, defaults={"reportId" = null}, name="report_new")
     * @Template()
     */
    public function formAction(Request $request, Report $report = null, $type = null)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $reportForm = $this->get('bagheera.report')->getForm($user, $report, $type);
        if (null === $reportForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $reportForm->bindRequest($request);

            if ($this->get('bagheera.report')->saveForm($user, $reportForm)) {
                $this->get('session')->setFlash('notice', 'report_form_confirmation');

                return $this->redirect($this->generateUrl('report_list'));
            }
        }

        return array(
            'reportForm' => $reportForm->createView()
        );
    }

    /**
     * @Route("/reports.js", defaults={"_format"="js"}, name="report_graph")
     * @Template()
     */
    public function graphAction()
    {
        $graphs = array();

        $user = $this->get('security.context')->getToken()->getUser();

        $reports = $this->get('bagheera.report')->getHomepageList($user);

        foreach ($reports as $report) {
            $data = $graphData = $this->get('bagheera.report')->getGraphData($user, $report);

            if (!empty($data)) {
                sort($data[0]); // to remove keys
                sort($data[1]);

                $yaxisMin = (int)min(array_merge($data[0], $data[1], array(0)));
                $yaxisMax = (int)(max(array_merge($data[0], $data[1], array(0))) * 1.1);

                $tmp = pow(10, (strlen($yaxisMin) - 2));
                $yaxisMin = floor($yaxisMin / $tmp) * $tmp;

                $tmp = pow(10, (strlen($yaxisMax) - 2));
                $yaxisMax = ceil($yaxisMax / $tmp) * $tmp;

                $graphs[] = array(
                    'report' => $report,
                    'data' => $graphData,
                    'yaxisMin' => $yaxisMin,
                    'yaxisMax' => $yaxisMax
                );
            }
        }

        return array(
            'graphs' => $graphs
        );
    }

    /**
     * @Route("report_synthesis.js", defaults={"_format"="js"}, name="report_synthesis")
     * @Template()
     */
    public function synthesisAction()
    {
        $graph = array();

        $user = $this->get('security.context')->getToken()->getUser();

        $data = $graphData = $this->get('bagheera.report')->getSynthesis($user);

        if (!empty($data)) {
            sort($data); // to remove keys

            $yaxisMin = (int)(min(array_merge($data, array(0))) * 1.1);
            $yaxisMax = (int)(max(array_merge($data, array(0))) * 1.1);

            $tmp = pow(10, (strlen(abs($yaxisMin)) - 2));
            $yaxisMin = floor($yaxisMin / $tmp) * $tmp;

            $tmp = pow(10, (strlen($yaxisMax) - 2));
            $yaxisMax = ceil($yaxisMax / $tmp) * $tmp;
            $numberTicks = 6;

            $graph = array(
                'graph' => $graphData,
                'yaxisMin' => $yaxisMin,
                'yaxisMax' => $yaxisMax,
                'numberTicks' => $numberTicks,
                'ticks' => $this->get('bagheera.report')->getSynthesisYAxisTicks($graphData, $yaxisMin, $yaxisMax, $numberTicks)
            );
        }

        return $graph;
    }
}
