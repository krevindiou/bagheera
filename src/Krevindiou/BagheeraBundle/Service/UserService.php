<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
    Symfony\Bundle\FrameworkBundle\Translation\Translator,
    Symfony\Bundle\FrameworkBundle\Routing\Router,
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
    public function getRegisterForm()
    {
        $form = $this->_formFactory->create(new UserRegisterForm(), new User());

        return $form;
    }

    /**
     * Adds user
     *
     * @param  User $user User entity
     * @return boolean
     */
    public function add(User $user)
    {
        $errors = $this->_validator->validate($user);

        if (0 == count($errors)) {
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
                ->setTo(array($user->getEmail() => $user->getFirstname() . ' ' . $user->getLastname()))
                ->setBody($body);

            $user->setActivation($key);

            $encoder = $this->_encoderFactory->getEncoder($user);
            $user->setPassword($encoder->encodePassword($user->getPassword(), $user->getSalt()));

            try {
                $this->_em->persist($user);
                $this->_em->flush();

                $this->_mailer->send($message);

                return true;
            } catch (\Exception $e) {
            }
        }

        return false;
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
     * Updates user
     *
     * @param  User $user User entity
     * @return boolean
     */
    public function update(User $user)
    {
        $errors = $this->_validator->validate($user);

        if (0 == count($errors)) {
            try {
                $this->_em->persist($user);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
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
     * @param  string $email Email to send link
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
                ->setTo(array($user->getEmail() => $user->getFirstname() . ' ' . $user->getLastname()))
                ->setBody($body);

            try {
                $this->_mailer->send($message);

                return true;
            } catch (\Exception $e) {
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
            }
        }

        return false;
    }

    /**
     * Creates reset password key
     *
     * @param  User $user User entity
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
            }
        }

        return false;
    }

    /**
     * Gets users list
     *
     * @param  array $params Search criterias
     * @param  integer $page Page number
     * @return array
     */
    public function getUsers(array $params = array(), $page = 1)
    {
        $dql = 'SELECT u ';
        $dql.= 'FROM KrevindiouBagheeraBundle:User u ';
        $dql.= 'WHERE 1 = 1 ';
        if (!empty($params)) {
            if (isset($params['firstname']) && '' != $params['firstname']) {
                $dql.= 'AND u.firstname LIKE :firstname ';
            }
            if (isset($params['lastname']) && '' != $params['lastname']) {
                $dql.= 'AND u.lastname LIKE :lastname ';
            }
            if (isset($params['email']) && '' != $params['email']) {
                $dql.= 'AND u.email LIKE :email ';
            }
            if (isset($params['isActive']) && '' != $params['isActive']) {
                $dql.= 'AND u.isActive = :isActive ';
            }
            if (isset($params['isAdmin']) && '' != $params['isAdmin']) {
                $dql.= 'AND u.isAdmin = :isAdmin ';
            }
        }
        $dql.= 'ORDER BY u.createdAt DESC ';
        $query = $this->_em->createQuery($dql);
        if (!empty($params)) {
            if (isset($params['firstname']) && '' != $params['firstname']) {
                $query->setParameter('firstname', $params['firstname'] . '%');
            }
            if (isset($params['lastname']) && '' != $params['lastname']) {
                $query->setParameter('lastname', $params['lastname'] . '%');
            }
            if (isset($params['email']) && '' != $params['email']) {
                $query->setParameter('email', $params['email'] . '%');
            }
            if (isset($params['isActive']) && '' != $params['isActive']) {
                $query->setParameter('isActive', $params['isActive']);
            }
            if (isset($params['isAdmin']) && '' != $params['isAdmin']) {
                $query->setParameter('isAdmin', $params['isAdmin']);
            }
        }

        return $query->getResult();
    }

    /**
     * Gets user balance
     *
     * @param  User $user User entity
     * @return float
     */
    public function getBalance(User $user)
    {
        $balance = 0;
        $banks = $user->getBanks();
        foreach ($banks as $bank) {
            $balance+= $this->_bankService->getBalance($user, $bank);
        }

        return sprintf('%.2f', $balance);
    }
}
