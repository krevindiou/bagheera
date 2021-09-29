<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Member;
use App\Form\Model\MemberChangePasswordFormModel;
use App\Form\Model\MemberForgotPasswordFormModel;
use App\Form\Model\MemberProfileFormModel;
use App\Form\Model\MemberRegisterFormModel;
use App\Form\Type\MemberChangePasswordFormType;
use App\Form\Type\MemberForgotPasswordFormType;
use App\Form\Type\MemberProfileFormType;
use App\Form\Type\MemberRegisterFormType;
use App\Repository\AccountImportRepository;
use App\Repository\MemberRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoderInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Contracts\Translation\TranslatorInterface;
use Twig\Environment;

class MemberService
{
    public function __construct(private string $secret, private LoggerInterface $logger, private EntityManagerInterface $entityManager, private \Swift_Mailer $mailer, private array $config, private TranslatorInterface $translator, private RouterInterface $router, private UserPasswordEncoderInterface $passwordEncoder, private FormFactoryInterface $formFactory, private ValidatorInterface $validator, private BankService $bankService, private AccountService $accountService, private CryptService $cryptService, private Environment $templating, private MemberRepository $memberRepository, private AccountImportRepository $accountImportRepository)
    {
    }

    /**
     * Returns register form.
     */
    public function getRegisterForm(string $language): FormInterface
    {
        $formModel = new MemberRegisterFormModel();

        return $this->formFactory->create(
            MemberRegisterFormType::class,
            $formModel,
            ['attr' => ['language' => $language]]
        );
    }

    /**
     * Returns profile form.
     */
    public function getProfileForm(Member $member): FormInterface
    {
        $formModel = new MemberProfileFormModel();
        $formModel->email = $member->getEmail();

        return $this->formFactory->create(MemberProfileFormType::class, $formModel);
    }

    /**
     * Creates register key.
     */
    public function createRegisterKey(Member $member): string
    {
        $data = [
            'type' => 'register',
            'email' => $member->getEmail(),
        ];

        return $this->cryptService->encrypt(json_encode($data), $this->secret);
    }

    public function saveRegisterForm(MemberRegisterFormModel $formModel): bool
    {
        $errors = $this->validator->validate($formModel);
        if (0 !== count($errors)) {
            return false;
        }

        $member = new Member();
        $member->setEmail($formModel->email);
        $member->setCountry($formModel->country);
        $member->setPassword($this->passwordEncoder->encodePassword($member, $formModel->plainPassword));
        $errors = $this->validator->validate($member);
        if (0 !== count($errors)) {
            return false;
        }

        return $this->add($member);
    }

    public function saveProfileForm(Member $member, MemberProfileFormModel $formModel): bool
    {
        $errors = $this->validator->validate($formModel);
        if (0 !== count($errors)) {
            return false;
        }

        $member->setEmail($formModel->email);

        return $this->update($member);
    }

    /**
     * Returns forgot password form.
     */
    public function getForgotPasswordForm(): FormInterface
    {
        $formModel = new MemberForgotPasswordFormModel();

        return $this->formFactory->create(MemberForgotPasswordFormType::class, $formModel);
    }

    /**
     * Sends email with change password link.
     */
    public function sendChangePasswordEmail(string $email): bool
    {
        $member = $this->memberRepository->findOneByEmail($email);
        if (null !== $member) {
            // Change password link construction
            $key = $this->createChangePasswordKey($member);
            $link = $this->router->generate('member_change_password_public', ['_locale' => 'en', 'key' => $key], UrlGeneratorInterface::ABSOLUTE_URL);

            $body = $this->templating->render(
                'Email/changePassword.html.twig',
                ['link' => $link]
            );

            $message = (new \Swift_Message())
                ->setSubject($this->translator->trans('member.forgot_password.email_subject'))
                ->setFrom([$this->config['sender_email'] => $this->config['sender_name']])
                ->setTo([$member->getEmail()])
                ->setBody($body, 'text/html')
            ;

            try {
                $this->mailer->send($message);

                return true;
            } catch (\Exception $e) {
                $this->logger->error($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Returns change password form.
     */
    public function getChangePasswordForm(): FormInterface
    {
        $formModel = new MemberChangePasswordFormModel();

        return $this->formFactory->create(MemberChangePasswordFormType::class, $formModel);
    }

    /**
     * Updates password.
     */
    public function changePassword(Member $member, string $password): bool
    {
        $member->setPassword($this->passwordEncoder->encodePassword($member, $password));

        try {
            $this->entityManager->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());
        }

        return false;
    }

    /**
     * Creates change password key.
     */
    public function createChangePasswordKey(Member $member): string
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
     */
    public function decodeChangePasswordKey(string $key): Member
    {
        $data = $this->cryptService->decrypt($key, $this->secret);

        if (null !== ($data = json_decode($data, true))) {
            if (isset($data['type'], $data['email'], $data['expiration']) && 'change_password' === $data['type']) {
                $now = new \DateTime();
                if ($data['expiration'] >= $now->format(\DateTime::ISO8601)) {
                    return $this->memberRepository->findOneByEmail($data['email']);
                }
            }
        }

        throw new \Exception('Cannot decode key');
    }

    /**
     * Activates the member.
     */
    public function activate(string $key): bool
    {
        if (null !== $member = $this->decodeRegisterKey($key)) {
            $member->setActive(true);

            try {
                $this->entityManager->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->error($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Gets member balances.
     */
    public function getBalances(Member $member): array
    {
        $balances = [];

        $banks = $member->getBanks();
        foreach ($banks as $bank) {
            if (!$bank->isDeleted()) {
                $bankBalances = $this->bankService->getBalances($bank);

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
     */
    public function getImportProgress(Member $member): ?array
    {
        return $this->accountImportRepository->getImportProgress($member);
    }

    /**
     * Checks if new account tip is displayed.
     */
    public function hasNewAccountTip(Member $member): bool
    {
        $tipNewAccount = false;

        $hasBankWithoutProvider = $this->hasBankWithoutProvider($member);
        if ($hasBankWithoutProvider) {
            $accounts = $this->accountService->getList($member);

            if (0 === count($accounts)) {
                $tipNewAccount = true;
            }
        }

        return $tipNewAccount;
    }

    /**
     * Adds member.
     */
    protected function add(Member $member): bool
    {
        try {
            $this->entityManager->persist($member);
            $this->entityManager->flush();
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());

            return false;
        }

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

        try {
            $this->mailer->send($message);
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Decodes register key.
     */
    protected function decodeRegisterKey(string $key): Member
    {
        $data = $this->cryptService->decrypt($key, $this->secret);

        if ($data && null !== ($data = json_decode($data, true))) {
            if (isset($data['type'], $data['email']) && 'register' === $data['type']) {
                return $this->memberRepository->findOneByEmail($data['email']);
            }
        }

        throw new \Exception('Cannot decode key');
    }

    /**
     * Updates member.
     */
    protected function update(Member $member): bool
    {
        try {
            $this->entityManager->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->error($e->getMessage());
        }

        return false;
    }

    /**
     * Checks if member has one or more banks without provider.
     */
    protected function hasBankWithoutProvider(Member $member): bool
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
}
