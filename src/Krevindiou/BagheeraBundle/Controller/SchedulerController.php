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
    Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter,
    Krevindiou\BagheeraBundle\Entity\Scheduler,
    Krevindiou\BagheeraBundle\Entity\Account;

class SchedulerController extends Controller
{
    /**
     * @Route("/schedulers-account-{accountId}", requirements={"accountId" = "\d+"}, name="scheduler_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request, Account $account)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $page = $request->query->getInt('page', 1);

        $schedulers = $this->get('bagheera.scheduler')->getList($user, $account, $page);
        if (null === $schedulers) {
            throw $this->createNotFoundException();
        }

        return array(
            'account' => $account,
            'schedulers' => $schedulers,
        );
    }

    /**
     * @Route("/schedulers-account-{accountId}", requirements={"accountId" = "\d+"})
     * @Method("POST")
     */
    public function listActionsAction(Request $request, Account $account)
    {
        if ($request->request->has('delete')) {
            $schedulersId = (array)$request->request->get('schedulersId');
            $user = $this->get('security.context')->getToken()->getUser();

            $this->get('bagheera.scheduler')->delete($user, $schedulersId);
            $this->get('session')->getFlashBag()->add('success', 'scheduler_delete_confirmation');
        }

        return $this->redirect(
            $this->generateUrl('scheduler_list', array('accountId' => $account->getAccountId()))
        );
    }

    /**
     * @Route("/edit-scheduler-{schedulerId}", requirements={"schedulerId" = "\d+"}, defaults={"accountId" = null}, name="scheduler_edit")
     * @Route("/new-scheduler-account-{accountId}", requirements={"accountId" = "\d+"}, defaults={"schedulerId" = null}, name="scheduler_new")
     * @ParamConverter("scheduler", class="KrevindiouBagheeraBundle:Scheduler", options={"id" = "schedulerId"})
     * @ParamConverter("account", class="KrevindiouBagheeraBundle:Account", options={"id" = "accountId"})
     * @Template()
     */
    public function formAction(Request $request, Account $account = null, Scheduler $scheduler = null)
    {
        $user = $this->get('security.context')->getToken()->getUser();

        $schedulerForm = $this->get('bagheera.scheduler')->getForm($user, $scheduler, $account);
        if (null === $schedulerForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $schedulerForm->bind($request);

            if ($this->get('bagheera.scheduler')->saveForm($user, $schedulerForm)) {
                $this->get('session')->getFlashBag()->add('success', 'scheduler_form_confirmation');

                return $this->redirect(
                    $this->generateUrl('scheduler_list', array('accountId' => $schedulerForm->getData()->getAccount()->getAccountId()))
                );
            }
        }

        return array(
            'account' => $account ? : $scheduler->getAccount(),
            'scheduler' => $schedulerForm->getData(),
            'schedulerForm' => $schedulerForm->createView()
        );
    }
}
