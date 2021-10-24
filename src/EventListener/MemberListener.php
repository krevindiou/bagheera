<?php

declare(strict_types=1);

namespace App\EventListener;

use App\Entity\Member;
use App\Service\CryptService;
use Doctrine\Persistence\Event\LifecycleEventArgs;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Contracts\Translation\TranslatorInterface;
use Twig\Environment;

class MemberListener
{
    public function __construct(
        private string $secret,
        private array $config,
        private RouterInterface $router,
        private Environment $templating,
        private TranslatorInterface $translator,
        private \Swift_Mailer $mailer,
        private CryptService $cryptService,
    ) {
    }

    public function postPersist(Member $member, LifecycleEventArgs $event): void
    {
        // Activation link construction
        $key = $this->createRegisterKey($member);
        $link = $this->router->generate('member_activate', ['_locale' => 'en', 'key' => $key], UrlGeneratorInterface::ABSOLUTE_URL);

        $body = $this->templating->render(
            'Email/register.html.twig',
            ['link' => $link]
        );

        $message = (new \Swift_Message())
            ->setSubject($this->translator->trans('member.register.email_subject'))
            ->setFrom([$this->config['sender_email'] => $this->config['sender_name']])
            ->setTo([$member->getEmail()])
            ->setBody($body, 'text/html')
        ;

        $this->mailer->send($message);
    }

    private function createRegisterKey(Member $member): string
    {
        $data = [
            'type' => 'register',
            'email' => $member->getEmail(),
        ];

        return $this->cryptService->encrypt(json_encode($data), $this->secret);
    }
}
