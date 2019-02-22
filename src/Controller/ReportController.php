<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Report;
use App\Service\ReportService;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/manager")
 */
class ReportController extends AbstractController
{
    /**
     * @Route("/reports", methods={"GET"}, name="report_list")
     */
    public function list(Request $request, ReportService $reportService)
    {
        $member = $this->getUser();

        $reports = $reportService->getList($member);

        return $this->render(
            'Report/list.html.twig',
            [
                'reports' => $reports,
            ]
        );
    }

    /**
     * @Route("/reports", methods={"POST"})
     */
    public function listActions(Request $request, ReportService $reportService)
    {
        $reportsId = (array) $request->request->get('reportsId');

        $member = $this->getUser();

        if ($request->request->has('delete')) {
            $reportService->delete($member, $reportsId);
            $this->addFlash('success', 'report.delete_confirmation');
        }

        return $this->redirectToRoute('report_list');
    }

    /**
     * @Route("/report-{reportId}", requirements={"reportId" = "\d+"}, name="report_update")
     * @Route("/create-{type}-report", requirements={"type" = "sum|average|distribution|estimate"}, defaults={"reportId" = null}, name="report_create")
     * @ParamConverter("report", class="App:Report", options={"id" = "reportId"})
     */
    public function form(Request $request, ReportService $reportService, ?Report $report, string $type = null)
    {
        $member = $this->getUser();

        $reportForm = $reportService->getForm($member, $report, $type);
        if (null === $reportForm) {
            throw $this->createNotFoundException();
        }

        $reportForm->handleRequest($request);

        if ($reportForm->isSubmitted()) {
            if ($reportService->saveForm($member, $reportForm)) {
                $this->addFlash('success', 'report.form_confirmation');

                return $this->redirectToRoute('report_list');
            }
        }

        return $this->render(
            'Report/form.html.twig',
            [
                'reportForm' => $reportForm->createView(),
            ]
        );
    }

    /**
     * @Route("/reports.js", defaults={"_format"="js"}, name="report_graph")
     */
    public function graph(ReportService $reportService)
    {
        $graphs = [];

        $member = $this->getUser();

        $reports = $reportService->getHomepageList($member);

        foreach ($reports as $report) {
            $graph = $reportService->getGraphData($member, $report);

            if (!empty($graph)) {
                $graphs[] = $graph;
            }
        }

        return $this->render(
            'Report/graph.js.twig',
            [
                'graphs' => $graphs,
            ]
        );
    }

    /**
     * @Route("/report-synthesis.js", defaults={"_format"="js", "accountId"=null}, name="report_synthesis")
     * @Route("/account-{accountId}/report-synthesis.js", requirements={"accountId" = "\d+"}, defaults={"_format"="js"}, name="report_synthesis_account")
     */
    public function synthesis(ReportService $reportService, ?Account $account)
    {
        $member = $this->getUser();

        $graph = $reportService->getSynthesis($member, null, null, $account);

        if (!empty($graph)) {
            return $this->render('Report/synthesis.js.twig', $graph);
        }

        throw $this->createNotFoundException();
    }
}
