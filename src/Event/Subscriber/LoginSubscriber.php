<?php

declare(strict_types=1);

namespace App\Event\Subscriber;

use App\Entity\Member;
use App\Service\SchedulerService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Security\Http\Event\InteractiveLoginEvent;

class LoginSubscriber implements EventSubscriberInterface
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

    /**
     * @return array<string, mixed>
     */
    public static function getSubscribedEvents(): array
    {
        return ['security.interactive_login' => 'onSecurityInteractiveLogin'];
    }
}
