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
use Krevindiou\BagheeraBundle\Entity\Scheduler;
use Krevindiou\BagheeraBundle\Entity\Account;

/**
 * @Route("/manager")
 */
class SchedulerController extends Controller
{
    /**
     * @Route("/account-{accountId}/schedulers", requirements={"accountId" = "\d+"}, name="scheduler_list")
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request, Account $account)
    {
        $member = $this->getUser();

        $page = $request->query->getInt('page', 1);

        $schedulers = $this->get('bagheera.scheduler')->getList($member, $account, $page);
        if (null === $schedulers) {
            throw $this->createNotFoundException();
        }

        return array(
            'account' => $account,
            'schedulers' => $schedulers,
        );
    }

    /**
     * @Route("/account-{accountId}/schedulers", requirements={"accountId" = "\d+"})
     * @Method("POST")
     */
    public function listActionsAction(Request $request, Account $account)
    {
        if ($request->request->has('delete')) {
            $schedulersId = (array) $request->request->get('schedulersId');
            $member = $this->getUser();

            $this->get('bagheera.scheduler')->delete($member, $schedulersId);
            $this->get('session')->getFlashBag()->add('success', 'scheduler.delete_confirmation');
        }

        return $this->redirect(
            $this->generateUrl('scheduler_list', array('accountId' => $account->getAccountId()))
        );
    }

    /**
     * @Route("/scheduler-{schedulerId}", requirements={"schedulerId" = "\d+"}, defaults={"accountId" = null}, name="scheduler_edit")
     * @Route("/account-{accountId}/new-scheduler", requirements={"accountId" = "\d+"}, defaults={"schedulerId" = null}, name="scheduler_new")
     * @ParamConverter("scheduler", class="KrevindiouBagheeraBundle:Scheduler", options={"id" = "schedulerId"})
     * @ParamConverter("account", class="KrevindiouBagheeraBundle:Account", options={"id" = "accountId"})
     * @Template()
     */
    public function formAction(Request $request, Account $account = null, Scheduler $scheduler = null)
    {
        $member = $this->getUser();

        $schedulerForm = $this->get('bagheera.scheduler')->getForm($member, $scheduler, $account);
        if (null === $schedulerForm) {
            throw $this->createNotFoundException();
        }

        if ($request->getMethod() == 'POST') {
            $schedulerForm->bind($request);

            if ($this->get('bagheera.scheduler')->saveForm($member, $schedulerForm)) {
                $this->get('session')->getFlashBag()->add('success', 'scheduler.form_confirmation');

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
