<?php

namespace App\EventListener;

use Psr\Log\LoggerInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Http\Event\InteractiveLoginEvent;
use App\Service\SchedulerService;

class LoginListener
{
    private $logger;
    private $em;
    private $schedulerService;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        SchedulerService $schedulerService
    )
    {
        $this->logger = $logger;
        $this->em = $em;
        $this->schedulerService = $schedulerService;
    }

    public function onSecurityInteractiveLogin(InteractiveLoginEvent $event)
    {
        $member = $event->getAuthenticationToken()->getUser();

        $member->setLoggedAt(new \DateTime());

        try {
            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }

        $this->schedulerService->runSchedulers($member);
    }
}
