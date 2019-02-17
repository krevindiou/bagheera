<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Scheduler;
use App\Service\SchedulerService;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Method;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Security;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;

/**
 * @Route("/manager")
 */
class SchedulerController extends AbstractController
{
    /**
     * @Route("/account-{accountId}/schedulers", requirements={"accountId" = "\d+"}, name="scheduler_list")
     * @Security("account.isOwner(user)")
     *
     * @Method("GET")
     */
    public function listAction(Request $request, SchedulerService $schedulerService, Account $account)
    {
        $page = $request->query->getInt('page', 1);

        $schedulers = $schedulerService->getList($account, $page);

        if (null === $schedulers) {
            throw $this->createNotFoundException();
        }

        return $this->render(
            'Scheduler/list.html.twig',
            [
                'account' => $account,
                'schedulers' => $schedulers,
            ]
        );
    }

    /**
     * @Route("/account-{accountId}/schedulers", requirements={"accountId" = "\d+"})
     * @Security("account.isOwner(user)")
     *
     * @Method("POST")
     */
    public function listActionsAction(Request $request, SchedulerService $schedulerService, Account $account)
    {
        if ($request->request->has('delete')) {
            $schedulersId = (array) $request->request->get('schedulersId');
            $member = $this->getUser();

            foreach ($schedulersId as $schedulerId) {
                $scheduler = $this->em->find('App:Scheduler', $schedulerId);

                if (!$scheduler->isOwner($member)) {
                    throw $this->createAccessDeniedException();
                }
            }

            $schedulerService->delete($scheduler);
            $this->addFlash('success', 'scheduler.delete_confirmation');
        }

        return $this->redirectToRoute('scheduler_list', ['accountId' => $account->getAccountId()]);
    }

    /**
     * @Route("/scheduler-{schedulerId}", requirements={"schedulerId" = "\d+"}, defaults={"accountId" = null}, name="scheduler_update")
     * @Route("/account-{accountId}/create-scheduler", requirements={"accountId" = "\d+"}, defaults={"schedulerId" = null}, name="scheduler_create")
     * @ParamConverter("scheduler", class="App:Scheduler", options={"id" = "schedulerId"})
     * @ParamConverter("account", class="App:Account", options={"id" = "accountId"})
     * @Security("(account !== null and account.isOwner(user)) or (scheduler !== null and scheduler.isOwner(user))")
     */
    public function formAction(Request $request, SchedulerService $schedulerService, Account $account = null, Scheduler $scheduler = null)
    {
        $schedulerForm = $schedulerService->getForm($scheduler, $account);
        if (null === $schedulerForm) {
            throw $this->createNotFoundException();
        }

        $schedulerForm->handleRequest($request);

        if ($schedulerForm->isSubmitted()) {
            if ($schedulerService->saveForm($schedulerForm)) {
                $this->addFlash('success', 'scheduler.form_confirmation');

                return $this->redirectToRoute(
                    'scheduler_list',
                    ['accountId' => $schedulerForm->getData()->getAccount()->getAccountId()]
                );
            }
        }

        return $this->render(
            'Scheduler/form.html.twig',
            [
                'account' => $account ?: $scheduler->getAccount(),
                'scheduler' => $schedulerForm->getData(),
                'schedulerForm' => $schedulerForm->createView(),
            ]
        );
    }
}
