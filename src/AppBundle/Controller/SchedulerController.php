<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Security;
use AppBundle\Entity\Scheduler;
use AppBundle\Entity\Account;

/**
 * @Route("/manager")
 */
class SchedulerController extends Controller
{
    /**
     * @Route("/account-{accountId}/schedulers", requirements={"accountId" = "\d+"}, name="scheduler_list")
     * @Security("account.isOwner(user)")
     *
     * @Method("GET")
     * @Template()
     */
    public function listAction(Request $request, Account $account)
    {
        $page = $request->query->getInt('page', 1);

        $schedulers = $this->get('app.scheduler')->getList($account, $page);

        if (null === $schedulers) {
            throw $this->createNotFoundException();
        }

        return [
            'account' => $account,
            'schedulers' => $schedulers,
        ];
    }

    /**
     * @Route("/account-{accountId}/schedulers", requirements={"accountId" = "\d+"})
     * @Security("account.isOwner(user)")
     *
     * @Method("POST")
     */
    public function listActionsAction(Request $request, Account $account)
    {
        if ($request->request->has('delete')) {
            $schedulersId = (array) $request->request->get('schedulersId');
            $member = $this->getUser();

            foreach ($schedulersId as $schedulerId) {
                $scheduler = $this->em->find('Model:Scheduler', $schedulerId);

                if (!$scheduler->isOwner($member)) {
                    throw $this->createAccessDeniedException();
                }
            }

            $this->get('app.scheduler')->delete($scheduler);
            $this->get('session')->getFlashBag()->add('success', 'scheduler.delete_confirmation');
        }

        return $this->redirectToRoute('scheduler_list', ['accountId' => $account->getAccountId()]);
    }

    /**
     * @Route("/scheduler-{schedulerId}", requirements={"schedulerId" = "\d+"}, defaults={"accountId" = null}, name="scheduler_update")
     * @Route("/account-{accountId}/create-scheduler", requirements={"accountId" = "\d+"}, defaults={"schedulerId" = null}, name="scheduler_create")
     * @ParamConverter("scheduler", class="Model:Scheduler", options={"id" = "schedulerId"})
     * @ParamConverter("account", class="Model:Account", options={"id" = "accountId"})
     * @Security("(account !== null and account.isOwner(user)) or (scheduler !== null and scheduler.isOwner(user))")
     * @Template()
     */
    public function formAction(Request $request, Account $account = null, Scheduler $scheduler = null)
    {
        $schedulerForm = $this->get('app.scheduler')->getForm($scheduler, $account);
        if (null === $schedulerForm) {
            throw $this->createNotFoundException();
        }

        $schedulerForm->handleRequest($request);

        if ($schedulerForm->isSubmitted()) {
            if ($this->get('app.scheduler')->saveForm($schedulerForm)) {
                $this->get('session')->getFlashBag()->add('success', 'scheduler.form_confirmation');

                return $this->redirectToRoute(
                    'scheduler_list',
                    ['accountId' => $schedulerForm->getData()->getAccount()->getAccountId()]
                );
            }
        }

        return [
            'account' => $account ?: $scheduler->getAccount(),
            'scheduler' => $schedulerForm->getData(),
            'schedulerForm' => $schedulerForm->createView(),
        ];
    }
}
