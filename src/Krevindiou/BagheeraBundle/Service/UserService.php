<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Swift_Mailer,
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\Validator\Validator,
    Symfony\Component\HttpFoundation\Request,
    Symfony\Component\Security\Core\Encoder\EncoderFactory,
    Symfony\Component\Security\Http\Event\InteractiveLoginEvent,
    Symfony\Component\Translation\Translator,
    Symfony\Bundle\FrameworkBundle\Routing\Router,
    Symfony\Bridge\Monolog\Logger,
    Pagerfanta\Pagerfanta,
    Pagerfanta\Adapter\DoctrineORMAdapter,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Form\UserRegisterForm,
    Krevindiou\BagheeraBundle\Form\UserProfileForm,
    Krevindiou\BagheeraBundle\Form\UserForgotPasswordForm,
    Krevindiou\BagheeraBundle\Form\UserResetPasswordForm,
    Krevindiou\BagheeraBundle\Service\BankService;

/**
 * User service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class UserService
{
    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var Swift_Mailer
     */
    protected $_mailer;

    /**
     * @var array
     */
    protected $_config;

    /**
     * @var Translator
     */
    protected $_translator;

    /**
     * @var Router
     */
    protected $_router;

    /**
     * @var EncoderFactory
     */
    protected $_encoderFactory;

    /**
     * @var FormFactory
     */
    protected $_formFactory;

    /**
     * @var Validator
     */
    protected $_validator;

    /**
     * @var BankService
     */
    protected $_bankService;

    /**
     * @var SchedulerService
     */
    protected $_schedulerService;

    public function __construct(
        Logger $logger,
        EntityManager $em,
        Swift_Mailer $mailer,
        array $config,
        Translator $translator,
        Router $router,
        EncoderFactory $encoderFactory,
        FormFactory $formFactory,
        Validator $validator,
        BankService $bankService,
        SchedulerService $schedulerService)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_mailer = $mailer;
        $this->_config = $config;
        $this->_translator = $translator;
        $this->_router = $router;
        $this->_encoderFactory = $encoderFactory;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_bankService = $bankService;
        $this->_schedulerService = $schedulerService;
    }

    public function onLogin(InteractiveLoginEvent $event)
    {
        $this->_schedulerService->runSchedulers($event->getAuthenticationToken()->getUser());
    }

    /**
     * Returns register form
     *
     * @return Form
     */
    public function getRegisterForm($language)
    {
        $form = $this->_formFactory->create(
            new UserRegisterForm(),
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
        $form = $this->_formFactory->create(new UserProfileForm(), $user);

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
        $link = $this->_router->generate('user_activate', array('key' => $key), true);

        $body = str_replace(
            '%link%',
            $link,
            $this->_translator->trans('user_register_email_body')
        );

        $message = \Swift_Message::newInstance()
            ->setSubject($this->_translator->trans('user_register_email_subject'))
            ->setFrom(array($this->_config['sender_email'] => $this->_config['sender_name']))
            ->setTo(array($user->getEmail()))
            ->setBody($body);

        $user->setActivation($key);

        $encoder = $this->_encoderFactory->getEncoder($user);
        $user->setPassword($encoder->encodePassword($user->getPlainPassword(), $user->getSalt()));

        try {
            $this->_em->persist($user);
            $this->_em->flush();

            $this->_mailer->send($message);

            return true;
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());
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
            $this->_em->persist($user);
            $this->_em->flush();

            return true;
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());
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
        $errors = $this->_validator->validate($user);

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
            $user = $this->_em->find('KrevindiouBagheeraBundle:User', $userId);

            if (null !== $user) {
                $user->setIsActive(!$user->getIsActive());

                try {
                    $this->_em->persist($user);
                    $this->_em->flush();
                } catch (\Exception $e) {
                    $this->_logger->err($e->getMessage());
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
        $form = $this->_formFactory->create(new UserForgotPasswordForm());

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
        $user = $this->_em->getRepository('KrevindiouBagheeraBundle:User')
                          ->findOneBy(array('email' => $email));

        if (null !== $user) {
            // Reset password link construction
            $key = $this->_createResetPasswordKey($user);
            $link = $this->_router->generate('user_reset_password', array('key' => $key), true);

            // Mail sending
            $body = str_replace(
                '%link%',
                $link,
                $this->_translator->trans('user_forgot_password_email_body')
            );

            $message = \Swift_Message::newInstance()
                ->setSubject($this->_translator->trans('user_forgot_password_email_subject'))
                ->setFrom(array($this->_config['sender_email'] => $this->_config['sender_name']))
                ->setTo(array($user->getEmail()))
                ->setBody($body);

            try {
                $this->_mailer->send($message);

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
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
        if (null !== $this->_decodeResetPasswordKey($key)) {
            $form = $this->_formFactory->create(new UserResetPasswordForm());

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
        if (null !== ($user = $this->_decodeResetPasswordKey($key))) {
            $encoder = $this->_encoderFactory->getEncoder($user);
            $user->setPassword($encoder->encodePassword($password, $user->getSalt()));

            try {
                $this->_em->persist($user);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
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
    protected function _createResetPasswordKey(User $user)
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
    protected function _decodeResetPasswordKey($key)
    {
        if (false !== ($key = gzinflate(base64_decode($key)))) {
            $email = substr($key, 0, -33);
            $md5 = substr($key, -32);

            $user = $this->_em->getRepository('KrevindiouBagheeraBundle:User')
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
        $user = $this->_em->getRepository('KrevindiouBagheeraBundle:User')
                          ->findOneBy(array('activation' => $key));
        if (null !== $user) {
            $user->setIsActive(true);
            $user->setActivation(null);

            try {
                $this->_em->persist($user);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
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
            $this->_em->getRepository('KrevindiouBagheeraBundle:User')->getListQuery($params)
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
                $bankBalances = $this->_bankService->getBalances($user, $bank);

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
        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $user);

        try {
            $maxImportId = $query->getSingleScalarResult();
        } catch (\Exception $e) {
            return null;
        }

        $dql = 'SELECT i ';
        $dql.= 'FROM KrevindiouBagheeraBundle:AccountImport i INDEX BY i.accountId ';
        $dql.= 'WHERE i.importId = :maxImportId ';
        $query = $this->_em->createQuery($dql);
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
