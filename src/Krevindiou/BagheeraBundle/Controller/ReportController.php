<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Krevindiou\BagheeraBundle\Entity\Report;
use Krevindiou\BagheeraBundle\Entity\Account;

/**
 * @Route("/manager")
 */
class ReportController extends Controller
{
    /**
     * @Route("/reports", name="report_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request)
    {
        $member = $this->getUser();

        $reports = $this->get('bagheera.report')->getList($member);

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

        $member = $this->getUser();

        if ($request->request->has('delete')) {
            $this->get('bagheera.report')->delete($member, $reportsId);
            $this->get('session')->getFlashBag()->add('success', 'report.delete_confirmation');
        }

        return $this->redirect($this->generateUrl('report_list'));
    }

    /**
     * @Route("/report-{reportId}", requirements={"reportId" = "\d+"}, name="report_edit")
     * @Route("/new-{type}-report", requirements={"type" = "sum|average|distribution|estimate"}, defaults={"reportId" = null}, name="report_new")
     * @ParamConverter("report", class="KrevindiouBagheeraBundle:Report", options={"id" = "reportId"})
     * @Template()
     */
    public function formAction(Request $request, Report $report = null, $type = null)
    {
        $member = $this->getUser();

        $reportForm = $this->get('bagheera.report')->getForm($member, $report, $type);
        if (null === $reportForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $reportForm->bind($request);

            if ($this->get('bagheera.report')->saveForm($member, $reportForm)) {
                $this->get('session')->getFlashBag()->add('success', 'report.form_confirmation');

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

        $member = $this->getUser();

        $reports = $this->get('bagheera.report')->getHomepageList($member);

        foreach ($reports as $report) {
            $graph = $this->get('bagheera.report')->getGraphData($member, $report);

            if (!empty($graph)) {
                $graphs[] = $graph;
            }
        }

        return array(
            'graphs' => $graphs
        );
    }

    /**
     * @Route("/report-synthesis.js", defaults={"_format"="js", "accountId"=null}, name="report_synthesis")
     * @Route("/account-{accountId}/report-synthesis.js", requirements={"accountId" = "\d+"}, defaults={"_format"="js"}, name="report_synthesis_account")
     * @Template()
     */
    public function synthesisAction(Account $account = null)
    {
        $member = $this->getUser();

        $graph = $this->get('bagheera.report')->getSynthesis($member, null, null, $account);

        if (!empty($graph)) {
            return $graph;
        }

        throw $this->createNotFoundException();
    }
}
