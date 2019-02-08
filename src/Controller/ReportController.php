<?php

namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use AppBundle\Entity\Report;
use AppBundle\Entity\Account;

/**
 * @Route("/manager")
 */
class ReportController extends Controller
{
    /**
     * @Route("/reports", name="report_list")
     *
     * @Method("GET")
     */
    public function listAction(Request $request)
    {
        $member = $this->getUser();

        $reports = $this->get('app.report')->getList($member);

        return $this->render(
            'AppBundle:Report:list.html.twig',
            [
                'reports' => $reports,
            ]
        );
    }

    /**
     * @Route("/reports")
     *
     * @Method("POST")
     */
    public function listActionsAction(Request $request)
    {
        $reportsId = (array) $request->request->get('reportsId');

        $member = $this->getUser();

        if ($request->request->has('delete')) {
            $this->get('app.report')->delete($member, $reportsId);
            $this->addFlash('success', 'report.delete_confirmation');
        }

        return $this->redirectToRoute('report_list');
    }

    /**
     * @Route("/report-{reportId}", requirements={"reportId" = "\d+"}, name="report_update")
     * @Route("/create-{type}-report", requirements={"type" = "sum|average|distribution|estimate"}, defaults={"reportId" = null}, name="report_create")
     * @ParamConverter("report", class="AppBundle:Report", options={"id" = "reportId"})
     */
    public function formAction(Request $request, Report $report = null, $type = null)
    {
        $member = $this->getUser();

        $reportForm = $this->get('app.report')->getForm($member, $report, $type);
        if (null === $reportForm) {
            throw $this->createNotFoundException();
        }

        $reportForm->handleRequest($request);

        if ($reportForm->isSubmitted()) {
            if ($this->get('app.report')->saveForm($member, $reportForm)) {
                $this->addFlash('success', 'report.form_confirmation');

                return $this->redirectToRoute('report_list');
            }
        }

        return $this->render(
            'AppBundle:Report:form.html.twig',
            [
                'reportForm' => $reportForm->createView(),
            ]
        );
    }

    /**
     * @Route("/reports.js", defaults={"_format"="js"}, name="report_graph")
     */
    public function graphAction()
    {
        $graphs = [];

        $member = $this->getUser();

        $reports = $this->get('app.report')->getHomepageList($member);

        foreach ($reports as $report) {
            $graph = $this->get('app.report')->getGraphData($member, $report);

            if (!empty($graph)) {
                $graphs[] = $graph;
            }
        }

        return $this->render(
            'AppBundle:Report:graph.js.twig',
            [
                'graphs' => $graphs,
            ]
        );
    }

    /**
     * @Route("/report-synthesis.js", defaults={"_format"="js", "accountId"=null}, name="report_synthesis")
     * @Route("/account-{accountId}/report-synthesis.js", requirements={"accountId" = "\d+"}, defaults={"_format"="js"}, name="report_synthesis_account")
     */
    public function synthesisAction(Account $account = null)
    {
        $member = $this->getUser();

        $graph = $this->get('app.report')->getSynthesis($member, null, null, $account);

        if (!empty($graph)) {
            return $this->render('AppBundle:Report:synthesis.js.twig', $graph);
        }

        throw $this->createNotFoundException();
    }
}
