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
    public function __construct(private LoggerInterface $logger, private EntityManagerInterface $entityManager, private SchedulerService $schedulerService)
    {
    }

    public function onSecurityInteractiveLogin(InteractiveLoginEvent $event): void
    {
        $member = $event->getAuthenticationToken()->getUser();
        if (!$member instanceof Member) {
            return;
        }

        $member->setLoggedAt(new \DateTime());

        try {
            $this->entityManager->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());
        }

        $this->schedulerService->runSchedulers($member);
    }
}
