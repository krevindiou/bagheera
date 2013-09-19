<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\Validator\Validator;
use Symfony\Component\Security\Core\Encoder\EncoderFactory;
use Symfony\Component\Security\Http\Event\InteractiveLoginEvent;
use Symfony\Component\Translation\Translator;
use Symfony\Bundle\FrameworkBundle\Routing\Router;
use Symfony\Bridge\Monolog\Logger;
use Pagerfanta\Pagerfanta;
use Pagerfanta\Adapter\DoctrineORMAdapter;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\Member;
use Krevindiou\BagheeraBundle\Service\BankService;

/**
 * @DI\Service("bagheera.member")
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

    /** @DI\Inject("bagheera.bank") */
    public $bankService;

    /** @DI\Inject("bagheera.scheduler") */
    public $schedulerService;

    /** @DI\Inject("bagheera.crypt") */
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
            'member_register_type',
            new Member(),
            array('attr' => array('language' => $language))
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
        return $this->formFactory->create('member_profile_type', $member);
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
        $link = $this->router->generate('member_activate', array('_locale' => 'en', 'key' => $key), true);

        $body = $this->templating->render(
            'KrevindiouBagheeraBundle:Email:register.html.twig',
            array('link' => $link)
        );

        $message = \Swift_Message::newInstance()
            ->setSubject($this->translator->trans('member.register.email_subject'))
            ->setFrom(array($this->config['sender_email'] => $this->config['sender_name']))
            ->setTo(array($member->getEmail()))
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
     * @param Member  $member Member entity
     * @return string
     */
    public function createRegisterKey(Member $member)
    {
        $data = array(
            'type' => 'register',
            'email' => $member->getEmail(),
            'createdAt' => $member->getCreatedAt()->format(\DateTime::ISO8601)
        );

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
            return $this->em->getRepository('KrevindiouBagheeraBundle:Member')
                            ->findOneBy(array('email' => $data['email']));
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
     * Activates/Deactivates members
     *
     * @param  array $membersId Array of memberId
     * @return void
     */
    public function toggleDeactivation(array $membersId)
    {
        foreach ($membersId as $memberId) {
            $member = $this->em->find('KrevindiouBagheeraBundle:Member', $memberId);

            if (null !== $member) {
                $member->setActive(!$member->isActive());

                try {
                    $this->em->persist($member);
                    $this->em->flush();
                } catch (\Exception $e) {
                    $this->logger->err($e->getMessage());
                }
            }
        }
    }

    /**
     * Returns forgot password form
     *
     * @return Form
     */
    public function getForgotPasswordForm()
    {
        return $this->formFactory->create('member_forgot_password_type');
    }

    /**
     * Sends email with change password link
     *
     * @param  string  $email Email to send link
     * @return boolean
     */
    public function sendChangePasswordEmail($email)
    {
        $member = $this->em->getRepository('KrevindiouBagheeraBundle:Member')
                           ->findOneBy(array('email' => $email));

        if (null !== $member) {
            // Change password link construction
            $key = $this->createChangePasswordKey($member);
            $link = $this->router->generate('member_change_password_public', array('_locale' => 'en', 'key' => $key), true);

            $body = $this->templating->render(
                'KrevindiouBagheeraBundle:Email:changePassword.html.twig',
                array('link' => $link)
            );

            $message = \Swift_Message::newInstance()
                ->setSubject($this->translator->trans('member.forgot_password.email_subject'))
                ->setFrom(array($this->config['sender_email'] => $this->config['sender_name']))
                ->setTo(array($member->getEmail()))
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
        return $this->formFactory->create('member_change_password_type');
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
        $data = array(
            'type' => 'change_password',
            'email' => $member->getEmail(),
            'createdAt' => $member->getCreatedAt()->format(\DateTime::ISO8601)
        );

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
            return $this->em->getRepository('KrevindiouBagheeraBundle:Member')
                            ->findOneBy(array('email' => $data['email']));
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
     * Gets members list
     *
     * @param  array      $params      Search criterias
     * @param  integer    $currentPage Page number
     * @return Pagerfanta
     */
    public function getMembers(array $params = array(), $currentPage = 1)
    {
        $adapter = new DoctrineORMAdapter(
            $this->em->getRepository('KrevindiouBagheeraBundle:Member')->getListQuery($params)
        );

        $pager = new Pagerfanta($adapter);
        $pager->setMaxPerPage(20);
        $pager->setCurrentPage($currentPage);

        return $pager;
    }

    /**
     * Gets member balances
     *
     * @param  Member $member Member entity
     * @return array
     */
    public function getBalances(Member $member)
    {
        $balances = array();

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
        $dql.= 'FROM KrevindiouBagheeraBundle:AccountImport i ';
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
        $dql.= 'FROM KrevindiouBagheeraBundle:AccountImport i INDEX BY i.accountId ';
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
    public function hasBankWithoutProvider(Member $member)
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
