<?php

namespace App\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Security\Http\Event\InteractiveLoginEvent;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoderInterface;
use Symfony\Component\Templating\EngineInterface;
use Symfony\Contracts\Translation\TranslatorInterface;
use Psr\Log\LoggerInterface;
use Doctrine\ORM\EntityManagerInterface;
use App\Entity\Member;
use App\Form\Type\MemberChangePasswordFormType;
use App\Form\Type\MemberForgotPasswordFormType;
use App\Form\Type\MemberProfileFormType;
use App\Form\Type\MemberRegisterFormType;

/**
 * @DI\Tag("kernel.event_listener", attributes = {"event" = "security.interactive_login", "method" = "onLogin"})
 */
class MemberService
{
    private $secret;
    private $logger;
    private $em;
    private $mailer;
    private $config;
    private $translator;
    private $router;
    private $passwordEncoder;
    private $formFactory;
    private $validator;
    private $bankService;
    private $accountService;
    private $schedulerService;
    private $cryptService;
    private $templating;

    public function __construct(
        $secret,
        LoggerInterface $logger,
        EntityManagerInterface $em,
        \Swift_Mailer $mailer,
        $config,
        TranslatorInterface $translator,
        RouterInterface $router,
        UserPasswordEncoderInterface $passwordEncoder,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        BankService $bankService,
        AccountService $accountService,
        SchedulerService $schedulerService,
        CryptService $cryptService,
        EngineInterface $templating
    )
    {
        $this->secret = $secret;
        $this->logger = $logger;
        $this->em = $em;
        $this->mailer = $mailer;
        $this->config = $config;
        $this->translator = $translator;
        $this->router = $router;
        $this->passwordEncoder = $passwordEncoder;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->bankService = $bankService;
        $this->accountService = $accountService;
        $this->schedulerService = $schedulerService;
        $this->cryptService = $cryptService;
        $this->templating = $templating;
    }

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
     * Returns register form.
     *
     * @return Form
     */
    public function getRegisterForm($language)
    {
        return $this->formFactory->create(
            MemberRegisterFormType::class,
            new Member(),
            ['attr' => ['language' => $language]]
        );
    }

    /**
     * Returns profile form.
     *
     * @param Member $member Member entity
     *
     * @return Form
     */
    public function getProfileForm(Member $member)
    {
        return $this->formFactory->create(MemberProfileFormType::class, $member);
    }

    /**
     * Adds member.
     *
     * @param Member $member Member entity
     *
     * @return bool
     */
    protected function add(Member $member)
    {
        $member->setPassword($this->passwordEncoder->encodePassword($member, $member->getPlainPassword()));

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
            'Email/register.html.twig',
            ['link' => $link]
        );

        $message = (new \Swift_Message())
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
     * Creates register key.
     *
     * @param Member $member Member entity
     *
     * @return string
     */
    public function createRegisterKey(Member $member)
    {
        $data = [
            'type' => 'register',
            'email' => $member->getEmail(),
        ];

        return $this->cryptService->encrypt(json_encode($data), $this->secret);
    }

    /**
     * Decodes register key.
     *
     * @param string $key Encrypted register key
     *
     * @return Member
     */
    protected function decodeRegisterKey($key)
    {
        $data = $this->cryptService->decrypt($key, $this->secret);

        if (null !== ($data = json_decode($data, true))) {
            if (isset($data['type'], $data['email']) && 'register' == $data['type']) {
                return $this->em->getRepository('App:Member')
                                ->findOneBy(['email' => $data['email']]);
            }
        }
    }

    /**
     * Updates member.
     *
     * @param Member $member Member entity
     *
     * @return bool
     */
    protected function update(Member $member)
    {
        try {
            $this->em->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }

        return false;
    }

    /**
     * Saves member.
     *
     * @param Member $member Member entity
     *
     * @return bool
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
     * Saves member form.
     *
     * @param Form $form Member form
     *
     * @return bool
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
     * Returns forgot password form.
     *
     * @return Form
     */
    public function getForgotPasswordForm()
    {
        return $this->formFactory->create(MemberForgotPasswordFormType::class);
    }

    /**
     * Sends email with change password link.
     *
     * @param string $email Email to send link
     *
     * @return bool
     */
    public function sendChangePasswordEmail($email)
    {
        $member = $this->em->getRepository('App:Member')
                           ->findOneBy(['email' => $email]);

        if (null !== $member) {
            // Change password link construction
            $key = $this->createChangePasswordKey($member);
            $link = $this->router->generate('member_change_password_public', ['_locale' => 'en', 'key' => $key], true);

            $body = $this->templating->render(
                'Email/changePassword.html.twig',
                ['link' => $link]
            );

            $message = (new \Swift_Message())
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
     * Returns change password form.
     *
     * @return Form
     */
    public function getChangePasswordForm()
    {
        return $this->formFactory->create(MemberChangePasswordFormType::class);
    }

    /**
     * Updates password.
     *
     * @param Member $member   Member entity
     * @param string $password Password to set
     */
    public function changePassword(Member $member, $password)
    {
        $member->setPassword($this->passwordEncoder->encodePassword($member, $password));

        try {
            $this->em->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }

        return false;
    }

    /**
     * Creates change password key.
     *
     * @param Member $member Member entity
     *
     * @return string
     */
    public function createChangePasswordKey(Member $member)
    {
        $expiration = new \DateTime();
        $expiration->modify('+2 days');

        $data = [
            'type' => 'change_password',
            'email' => $member->getEmail(),
            'expiration' => $expiration->format(\DateTime::ISO8601),
        ];

        return $this->cryptService->encrypt(json_encode($data), $this->secret);
    }

    /**
     * Decodes change password key.
     *
     * @param string $key Encrypted change password key
     *
     * @return Member
     */
    public function decodeChangePasswordKey($key)
    {
        $data = $this->cryptService->decrypt($key, $this->secret);

        if (null !== ($data = json_decode($data, true))) {
            if (isset($data['type'], $data['email'], $data['expiration']) && 'change_password' == $data['type']) {
                $now = new \DateTime();
                if ($data['expiration'] >= $now->format(\DateTime::ISO8601)) {

                    return $this->em->getRepository('App:Member')
                                    ->findOneBy(['email' => $data['email']]);
                }
            }
        }
    }

    /**
     * Activates the member.
     *
     * @return bool
     */
    public function activate($key)
    {
        if (null !== $member = $this->decodeRegisterKey($key)) {
            $member->setActive(true);

            try {
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Gets member balances.
     *
     * @param Member $member Member entity
     *
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
                        $balances[$currency] += $bankBalance;
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
     * Gets import progress data.
     *
     * @param Member $member Member entity
     *
     * @return array
     */
    public function getImportProgress(Member $member)
    {
        // Fetch current importId
        $dql = 'SELECT MAX(i.importId) ';
        $dql .= 'FROM App:AccountImport i ';
        $dql .= 'JOIN i.account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND i.finished = false ';
        $query = $this->em->createQuery($dql);
        $query->setParameter('member', $member);

        try {
            $maxImportId = $query->getSingleScalarResult();
        } catch (\Exception $e) {
            return;
        }

        $dql = 'SELECT i ';
        $dql .= 'FROM App:AccountImport i INDEX BY i.accountId ';
        $dql .= 'WHERE i.importId = :maxImportId ';
        $query = $this->em->createQuery($dql);
        $query->setParameter('maxImportId', $maxImportId);

        try {
            return $query->getResult();
        } catch (\Exception $e) {
            return;
        }
    }

    /**
     * Checks if member has one or more banks without provider.
     *
     * @param Member $member Member entity
     *
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
     * Checks if new account tip is displayed.
     *
     * @param Member $member Member entity
     *
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
