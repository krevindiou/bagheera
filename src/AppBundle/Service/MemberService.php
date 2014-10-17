<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Security\Http\Event\InteractiveLoginEvent;
use JMS\DiExtraBundle\Annotation as DI;
use AppBundle\Entity\Member;

/**
 * @DI\Service("app.member")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "member"})
 * @DI\Tag("kernel.event_listener", attributes = {"event" = "security.interactive_login", "method" = "onLogin"})
 */
class MemberService
{
    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject */
    public $mailer;

    /** @DI\Inject("%email%") */
    public $config;

    /** @DI\Inject */
    public $translator;

    /** @DI\Inject */
    public $router;

    /** @DI\Inject("security.encoder_factory") */
    public $encoderFactory;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /** @DI\Inject */
    public $validator;

    /** @DI\Inject("app.bank") */
    public $bankService;

    /** @DI\Inject("app.account") */
    public $accountService;

    /** @DI\Inject("app.scheduler") */
    public $schedulerService;

    /** @DI\Inject("app.crypt") */
    public $cryptService;

    /** @DI\Inject */
    public $templating;

    public function onLogin(InteractiveLoginEvent $event)
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

    /**
     * Returns register form
     *
     * @return Form
     */
    public function getRegisterForm($language)
    {
        return $this->formFactory->create(
            'member_register',
            new Member(),
            ['attr' => ['language' => $language]]
        );
    }

    /**
     * Returns profile form
     *
     * @param  Member $member Member entity
     * @return Form
     */
    public function getProfileForm(Member $member)
    {
        return $this->formFactory->create('member_profile', $member);
    }

    /**
     * Adds member
     *
     * @param  Member  $member Member entity
     * @return boolean
     */
    protected function add(Member $member)
    {
        $encoder = $this->encoderFactory->getEncoder($member);
        $member->setPassword($encoder->encodePassword($member->getPlainPassword(), $member->getSalt()));

        try {
            $this->em->persist($member);
            $this->em->flush();
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());

            return false;
        }

        // Activation link construction
        $key = $this->createRegisterKey($member);
        $link = $this->router->generate('member_activate', ['_locale' => 'en', 'key' => $key], true);

        $body = $this->templating->render(
            'AppBundle:Email:register.html.twig',
            ['link' => $link]
        );

        $message = \Swift_Message::newInstance()
            ->setSubject($this->translator->trans('member.register.email_subject'))
            ->setFrom([$this->config['sender_email'] => $this->config['sender_name']])
            ->setTo([$member->getEmail()])
            ->setBody($body, 'text/html');

        try {
            $this->mailer->send($message);
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Creates register key
     *
     * @param  Member $member Member entity
     * @return string
     */
    public function createRegisterKey(Member $member)
    {
        $data = [
            'type' => 'register',
            'email' => $member->getEmail(),
            'createdAt' => $member->getCreatedAt()->format(\DateTime::ISO8601)
        ];

        return $this->cryptService->crypt($data);
    }

    /**
     * Decodes register key
     *
     * @param  string $key Encrypted register key
     * @return Member
     */
    protected function decodeRegisterKey($key)
    {
        $data = $this->cryptService->decrypt($key);

        if (null !== $data && 'register' == $data['type']) {
            return $this->em->getRepository('Model:Member')
                            ->findOneBy(['email' => $data['email']]);
        }
    }

    /**
     * Updates member
     *
     * @param  Member  $member Member entity
     * @return boolean
     */
    protected function update(Member $member)
    {
        try {
            $this->em->persist($member);
            $this->em->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }

        return false;
    }

    /**
     * Saves member
     *
     * @param  Member  $member Member entity
     * @return boolean
     */
    public function save(Member $member)
    {
        $errors = $this->validator->validate($member);

        if (0 == count($errors)) {
            if (null !== $member->getMemberId()) {
                return $this->update($member);
            } else {
                return $this->add($member);
            }
        }

        return false;
    }

    /**
     * Saves member form
     *
     * @param  Form    $form Member form
     * @return boolean
     */
    public function saveForm(Form $form)
    {
        if ($form->isValid()) {
            if (null !== $form->getData()->getMemberId()) {
                return $this->update($form->getData());
            } else {
                return $this->add($form->getData());
            }
        }

        return false;
    }

    /**
     * Returns forgot password form
     *
     * @return Form
     */
    public function getForgotPasswordForm()
    {
        return $this->formFactory->create('member_forgot_password');
    }

    /**
     * Sends email with change password link
     *
     * @param  string  $email Email to send link
     * @return boolean
     */
    public function sendChangePasswordEmail($email)
    {
        $member = $this->em->getRepository('Model:Member')
                           ->findOneBy(['email' => $email]);

        if (null !== $member) {
            // Change password link construction
            $key = $this->createChangePasswordKey($member);
            $link = $this->router->generate('member_change_password_public', ['_locale' => 'en', 'key' => $key], true);

            $body = $this->templating->render(
                'AppBundle:Email:changePassword.html.twig',
                ['link' => $link]
            );

            $message = \Swift_Message::newInstance()
                ->setSubject($this->translator->trans('member.forgot_password.email_subject'))
                ->setFrom([$this->config['sender_email'] => $this->config['sender_name']])
                ->setTo([$member->getEmail()])
                ->setBody($body, 'text/html');

            try {
                $this->mailer->send($message);

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Returns change password form
     *
     * @return Form
     */
    public function getChangePasswordForm()
    {
        return $this->formFactory->create('member_change_password');
    }

    /**
     * Updates password
     *
     * @param  Member $member   Member entity
     * @param  string $password Password to set
     * @return void
     */
    public function changePassword(Member $member, $password)
    {
        $encoder = $this->encoderFactory->getEncoder($member);
        $member->setPassword($encoder->encodePassword($password, $member->generateSalt()->getSalt()));

        try {
            $this->em->persist($member);
            $this->em->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }

        return false;
    }

    /**
     * Creates change password key
     *
     * @param  Member $member Member entity
     * @return string
     */
    public function createChangePasswordKey(Member $member)
    {
        $data = [
            'type' => 'change_password',
            'email' => $member->getEmail(),
            'createdAt' => $member->getCreatedAt()->format(\DateTime::ISO8601)
        ];

        $expiration = new \DateTime();
        $expiration->modify('+2 days');

        return $this->cryptService->crypt($data, $expiration);
    }

    /**
     * Decodes change password key
     *
     * @param  string $key Encrypted change password key
     * @return Member
     */
    public function decodeChangePasswordKey($key)
    {
        $data = $this->cryptService->decrypt($key);

        if (null !== $data && 'change_password' == $data['type']) {
            return $this->em->getRepository('Model:Member')
                            ->findOneBy(['email' => $data['email']]);
        }
    }

    /**
     * Activates the member
     *
     * @return boolean
     */
    public function activate($key)
    {
        if (null !== $member = $this->decodeRegisterKey($key)) {
            $member->setActive(true);

            try {
                $this->em->persist($member);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Gets member balances
     *
     * @param  Member $member Member entity
     * @return array
     */
    public function getBalances(Member $member)
    {
        $balances = [];

        $banks = $member->getBanks();
        foreach ($banks as $bank) {
            if (!$bank->isDeleted()) {
                $bankBalances = $this->bankService->getBalances($member, $bank);

                foreach ($bankBalances as $currency => $bankBalance) {
                    if (isset($balances[$currency])) {
                        $balances[$currency]+= $bankBalance;
                    } else {
                        $balances[$currency] = $bankBalance;
                    }
                }
            }
        }

        arsort($balances);

        return $balances;
    }

    /**
     * Gets import progress data
     *
     * @param  Member $member Member entity
     * @return array
     */
    public function getImportProgress(Member $member)
    {
        // Fetch current importId
        $dql = 'SELECT MAX(i.importId) ';
        $dql.= 'FROM Model:AccountImport i ';
        $dql.= 'JOIN i.account a ';
        $dql.= 'JOIN a.bank b ';
        $dql.= 'WHERE b.member = :member ';
        $dql.= 'AND i.finished = false ';
        $query = $this->em->createQuery($dql);
        $query->setParameter('member', $member);

        try {
            $maxImportId = $query->getSingleScalarResult();
        } catch (\Exception $e) {
            return null;
        }

        $dql = 'SELECT i ';
        $dql.= 'FROM Model:AccountImport i INDEX BY i.accountId ';
        $dql.= 'WHERE i.importId = :maxImportId ';
        $query = $this->em->createQuery($dql);
        $query->setParameter('maxImportId', $maxImportId);

        try {
            return $query->getResult();
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Checks if member has one or more banks without provider
     *
     * @param  Member $member Member entity
     * @return bool
     */
    protected function hasBankWithoutProvider(Member $member)
    {
        $banks = $member->getBanks();

        if (count($banks) > 0) {
            foreach ($banks as $bank) {
                if (null === $bank->getProvider()) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Checks if new account tip is displayed
     *
     * @param  Member $member Member entity
     * @return bool
     */
    public function hasNewAccountTip(Member $member)
    {
        $tipNewAccount = false;

        $hasBankWithoutProvider = $this->hasBankWithoutProvider($member);
        if ($hasBankWithoutProvider) {
            $accounts = $this->accountService->getList($member);

            if (count($accounts) == 0) {
                $tipNewAccount = true;
            }
        }

        return $tipNewAccount;
    }
}
