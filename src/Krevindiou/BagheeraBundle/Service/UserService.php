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
use Krevindiou\BagheeraBundle\Entity\User;
use Krevindiou\BagheeraBundle\Service\BankService;

/**
 * User service
 *
 *
 * @DI\Service("bagheera.user")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "user"})
 * @DI\Tag("kernel.event_listener", attributes = {"event" = "security.interactive_login", "method" = "onLogin"})
 */
class UserService
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

    public function onLogin(InteractiveLoginEvent $event)
    {
        $this->schedulerService->runSchedulers($event->getAuthenticationToken()->getUser());
    }

    /**
     * Returns register form
     *
     * @return Form
     */
    public function getRegisterForm($language)
    {
        $form = $this->formFactory->create(
            'user_register_type',
            new User(),
            array('attr' => array('language' => $language))
        );

        return $form;
    }

    /**
     * Returns profile form
     *
     * @param  User $user User entity
     * @return Form
     */
    public function getProfileForm(User $user)
    {
        $form = $this->formFactory->create('user_profile_type', $user);

        return $form;
    }

    /**
     * Adds user
     *
     * @param  User    $user User entity
     * @return boolean
     */
    protected function _add(User $user)
    {
        // Activation link construction

        $key = md5(uniqid(rand(), true));
        $link = $this->router->generate('user_activate', array('key' => $key), true);

        $body = str_replace(
            '%link%',
            $link,
            $this->translator->trans('user_register_email_body')
        );

        $message = \Swift_Message::newInstance()
            ->setSubject($this->translator->trans('user_register_email_subject'))
            ->setFrom(array($this->config['sender_email'] => $this->config['sender_name']))
            ->setTo(array($user->getEmail()))
            ->setBody($body);

        $user->setActivation($key);

        $encoder = $this->encoderFactory->getEncoder($user);
        $user->setPassword($encoder->encodePassword($user->getPlainPassword(), $user->getSalt()));

        try {
            $this->em->persist($user);
            $this->em->flush();

            $this->mailer->send($message);

            return true;
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }

        return false;
    }

    /**
     * Updates user
     *
     * @param  User    $user User entity
     * @return boolean
     */
    protected function _update(User $user)
    {
        try {
            $this->em->persist($user);
            $this->em->flush();

            return true;
        } catch (\Exception $e) {
            $this->logger->err($e->getMessage());
        }

        return false;
    }

    /**
     * Saves user
     *
     * @param  User    $user User entity
     * @return boolean
     */
    public function save(User $user)
    {
        $errors = $this->validator->validate($user);

        if (0 == count($errors)) {
            if (null !== $user->getUserId()) {
                return $this->_update($user);
            } else {
                return $this->_add($user);
            }
        }

        return false;
    }

    /**
     * Saves user form
     *
     * @param  Form    $form User form
     * @return boolean
     */
    public function saveForm(Form $form)
    {
        if ($form->isValid()) {
            if (null !== $form->getData()->getUserId()) {
                return $this->_update($form->getData());
            } else {
                return $this->_add($form->getData());
            }
        }

        return false;
    }

    /**
     * Activates/Deactivates users
     *
     * @param  array $usersId Array of userId
     * @return void
     */
    public function toggleDeactivation(array $usersId)
    {
        foreach ($usersId as $userId) {
            $user = $this->em->find('KrevindiouBagheeraBundle:User', $userId);

            if (null !== $user) {
                $user->setIsActive(!$user->getIsActive());

                try {
                    $this->em->persist($user);
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
        $form = $this->formFactory->create('user_forgot_password_type');

        return $form;
    }

    /**
     * Sends email with reset password link
     *
     * @param  string  $email Email to send link
     * @return boolean
     */
    public function sendResetPasswordEmail($email)
    {
        $user = $this->em->getRepository('KrevindiouBagheeraBundle:User')
                          ->findOneBy(array('email' => $email));

        if (null !== $user) {
            // Reset password link construction
            $key = $this->createResetPasswordKey($user);
            $link = $this->router->generate('user_reset_password', array('key' => $key), true);

            // Mail sending
            $body = str_replace(
                '%link%',
                $link,
                $this->translator->trans('user_forgot_password_email_body')
            );

            $message = \Swift_Message::newInstance()
                ->setSubject($this->translator->trans('user_forgot_password_email_subject'))
                ->setFrom(array($this->config['sender_email'] => $this->config['sender_name']))
                ->setTo(array($user->getEmail()))
                ->setBody($body);

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
     * Returns reset password form if key is valid
     *
     * @param  string $key Reset key
     * @return Form
     */
    public function getResetPasswordForm($key)
    {
        if (null !== $this->decodeResetPasswordKey($key)) {
            $form = $this->formFactory->create('user_reset_password_type');

            return $form;
        }
    }

    /**
     * Updates password if key is valid
     *
     * @param  string $password Password to set
     * @param  string $key      Reset key
     * @return void
     */
    public function resetPassword($password, $key)
    {
        if (null !== ($user = $this->decodeResetPasswordKey($key))) {
            $encoder = $this->encoderFactory->getEncoder($user);
            $user->setPassword($encoder->encodePassword($password, $user->getSalt()));

            try {
                $this->em->persist($user);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Creates reset password key
     *
     * @param  User   $user User entity
     * @return string
     */
    protected function createResetPasswordKey(User $user)
    {
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        return $key;
    }

    /**
     * Decodes reset password key and return user model
     *
     * @param  string $key Reset key
     * @return User
     */
    protected function decodeResetPasswordKey($key)
    {
        if (false !== ($key = gzinflate(base64_decode($key)))) {
            $email = substr($key, 0, -33);
            $md5 = substr($key, -32);

            $user = $this->em->getRepository('KrevindiouBagheeraBundle:User')
                              ->findOneBy(array('email' => $email));

            if (null !== $user) {
                if (md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601)) == $md5) {
                    return $user;
                }
            }
        }
    }

    /**
     * Activates the user
     *
     * @return boolean
     */
    public function activate($key)
    {
        $user = $this->em->getRepository('KrevindiouBagheeraBundle:User')
                          ->findOneBy(array('activation' => $key));
        if (null !== $user) {
            $user->setIsActive(true);
            $user->setActivation(null);

            try {
                $this->em->persist($user);
                $this->em->flush();

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Gets users list
     *
     * @param  array      $params      Search criterias
     * @param  integer    $currentPage Page number
     * @return Pagerfanta
     */
    public function getUsers(array $params = array(), $currentPage = 1)
    {
        $adapter = new DoctrineORMAdapter(
            $this->em->getRepository('KrevindiouBagheeraBundle:User')->getListQuery($params)
        );

        $pager = new Pagerfanta($adapter);
        $pager->setMaxPerPage(20);
        $pager->setCurrentPage($currentPage);

        return $pager;
    }

    /**
     * Gets user balances
     *
     * @param  User  $user User entity
     * @return array
     */
    public function getBalances(User $user)
    {
        $balances = array();

        $banks = $user->getBanks();
        foreach ($banks as $bank) {
            if (!$bank->isDeleted()) {
                $bankBalances = $this->bankService->getBalances($user, $bank);

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
     * @param  User  $user User entity
     * @return array
     */
    public function getImportProgress(User $user)
    {
        // Fetch current importId
        $dql = 'SELECT MAX(i.importId) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:AccountImport i ';
        $dql.= 'JOIN i.account a ';
        $dql.= 'JOIN a.bank b ';
        $dql.= 'WHERE b.user = :user ';
        $dql.= 'AND i.finished = 0 ';
        $query = $this->em->createQuery($dql);
        $query->setParameter('user', $user);

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
     * Checks if user has one or more banks without provider
     *
     * @param  User $user User entity
     * @return bool
     */
    public function hasBankWithoutProvider(User $user)
    {
        $banks = $user->getBanks();

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
