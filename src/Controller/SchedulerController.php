<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Account;
use App\Entity\Scheduler;
use App\Service\SchedulerService;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\ParamConverter;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Security;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route(path: '/manager')]
class SchedulerController extends AbstractController
{
    #[Route(path: '/account-{accountId}/schedulers', requirements: ['accountId' => '\d+'], methods: ['GET'], name: 'scheduler_list')]
    #[Security('account.isOwner(user)')]
    public function list(Request $request, SchedulerService $schedulerService, Account $account): Response
    {
        $page = $request->query->getInt('page', 1);
        $schedulers = $schedulerService->getList($account, $page);

        return $this->render(
            'Scheduler/list.html.twig',
            [
                'account' => $account,
                'schedulers' => $schedulers,
            ]
        );
    }

    #[Route(path: '/account-{accountId}/schedulers', requirements: ['accountId' => '\d+'], methods: ['POST'])]
    #[Security('account.isOwner(user)')]
    public function listActions(Request $request, SchedulerService $schedulerService, Account $account): Response
    {
        if ($request->request->has('delete')) {
            $schedulersId = (array) $request->request->get('schedulersId');
            $member = $this->getUser();

            foreach ($schedulersId as $schedulerId) {
                $scheduler = $this->getDoctrine()->getManager()->find(Scheduler::class, $schedulerId);

                if (!$scheduler->isOwner($member)) {
                    throw $this->createAccessDeniedException();
                }

                $schedulerService->delete($scheduler);
            }

            $this->addFlash('success', 'scheduler.delete_confirmation');
        }

        return $this->redirectToRoute('scheduler_list', ['accountId' => $account->getAccountId()]);
    }

    #[Route(path: '/scheduler-{schedulerId}', requirements: ['schedulerId' => '\d+'], defaults: ['accountId' => null], name: 'scheduler_update')]
    #[Route(path: '/account-{accountId}/create-scheduler', requirements: ['accountId' => '\d+'], defaults: ['schedulerId' => null], name: 'scheduler_create')]
    #[ParamConverter('scheduler', class: 'App:Scheduler', options: ['id' => 'schedulerId'])]
    #[ParamConverter('account', class: 'App:Account', options: ['id' => 'accountId'])]
    #[Security('(account !== null and account.isOwner(user)) or (scheduler !== null and scheduler.isOwner(user))')]
    public function form(Request $request, SchedulerService $schedulerService, ?Account $account, ?Scheduler $scheduler): Response
    {
        $schedulerForm = $schedulerService->getForm($scheduler, $account);
        $schedulerForm->handleRequest($request);
        if ($schedulerForm->isSubmitted()) {
            if ($schedulerService->saveForm($scheduler, $schedulerForm)) {
                $this->addFlash('success', 'scheduler.form_confirmation');

                return $this->redirectToRoute(
                    'scheduler_list',
                    ['accountId' => $schedulerForm->getData()->account->getAccountId()]
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
