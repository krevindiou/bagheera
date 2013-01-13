<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller,
    Symfony\Component\HttpFoundation\Request,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Method,
    Krevindiou\BagheeraBundle\Entity\Report,
    Krevindiou\BagheeraBundle\Entity\Account;

class ReportController extends Controller
{
    /**
     * @Route("/reports", name="report_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request)
    {
        $user = $this->getUser();

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
        $reportsId = (array) $request->request->get('reportsId');

        $user = $this->getUser();

        if ($request->request->has('delete')) {
            $this->get('bagheera.report')->delete($user, $reportsId);
            $this->get('session')->getFlashBag()->add('success', 'report_delete_confirmation');
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
        $user = $this->getUser();

        $reportForm = $this->get('bagheera.report')->getForm($user, $report, $type);
        if (null === $reportForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $reportForm->bind($request);

            if ($this->get('bagheera.report')->saveForm($user, $reportForm)) {
                $this->get('session')->getFlashBag()->add('success', 'report_form_confirmation');

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

        $user = $this->getUser();

        $reports = $this->get('bagheera.report')->getHomepageList($user);

        foreach ($reports as $report) {
            $graph = $this->get('bagheera.report')->getGraphData($user, $report);

            if (!empty($graph)) {
                $graphs[] = $graph;
            }
        }

        return array(
            'graphs' => $graphs
        );
    }

    /**
     * @Route("report_synthesis.js", defaults={"_format"="js", "accountId"=null}, name="report_synthesis")
     * @Route("report_synthesis_account_{accountId}.js", requirements={"accountId" = "\d+"}, defaults={"_format"="js"}, name="report_synthesis_account")
     * @Template()
     */
    public function synthesisAction(Account $account = null)
    {
        $user = $this->getUser();

        $graph = $this->get('bagheera.report')->getSynthesis($user, null, null, $account);

        if (!empty($graph)) {
            return $graph;
        }

        throw $this->createNotFoundException();
    }
}
