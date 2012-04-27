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
}
