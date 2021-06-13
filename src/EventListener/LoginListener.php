<?php

declare(strict_types=1);

namespace App\EventListener;

use App\Entity\Member;
use App\Service\SchedulerService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Security\Http\Event\InteractiveLoginEvent;

class LoginListener
{
    private $logger;
    private $em;
    private $schedulerService;

    public function __construct(
        LoggerInterface $logger,
        EntityManagerInterface $em,
        SchedulerService $schedulerService
    ) {
        $this->logger = $logger;
        $this->em = $em;
        $this->schedulerService = $schedulerService;
    }

    public function onSecurityInteractiveLogin(InteractiveLoginEvent $event): void
    {
        $member = $event->getAuthenticationToken()->getUser();
        if (!$member instanceof Member) {
            return;
        }

        $member->setLoggedAt(new \DateTime());

        try {
            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());
        }

        $this->schedulerService->runSchedulers($member);
    }
}
