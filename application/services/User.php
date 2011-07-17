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

namespace Application\Services;

use Application\Models\User as UserModel,
    Application\Models\Bank as BankModel,
    Application\Models\Account as AccountModel,
    Application\Forms\UserRegister as UserRegisterForm,
    Application\Forms\UserProfile as UserProfileForm,
    Application\Forms\UserLogin as UserLoginForm,
    Application\Forms\UserForgotPassword as UserForgotPasswordForm,
    Application\Forms\UserResetPassword as UserResetPasswordForm,
    Application\Services\Bank as BankService,
    Application\Services\Account as AccountService;

/**
 * User service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class User extends CrudAbstract
{
    public function getLoginForm(array $params = null)
    {
        $userLoginForm = new UserLoginForm();
        $userLoginForm->populate($params);

        return $userLoginForm;
    }

    public function getRegisterForm(array $extraValues = null)
    {
        return parent::getForm(new UserRegisterForm(), new UserModel(), $extraValues);
    }

    public function getProfileForm(UserModel $user = null, array $extraValues = null)
    {
        if (null === $user) {
            $user = new UserModel();
        }

        $userProfileForm = new UserProfileForm();
        if (null === $user->getUserId()) {
            $userProfileForm->getElement('password')->setRequired(true);
            $userProfileForm->getElement('passwordConfirmation')->setRequired(true);
        }

        return parent::getForm($userProfileForm, $user, $extraValues);
    }

    public function add(UserRegisterForm $userRegisterForm)
    {
        $password = $userRegisterForm->getElement('password');
        $passwordConfirmation = $userRegisterForm->getElement('passwordConfirmation');

        $values = array();
        if ('' != $password->getValue()) {
            $values['password'] = md5($password->getValue());
        }
        if ('' != $passwordConfirmation->getValue()) {
            $values['passwordConfirmation'] = md5($passwordConfirmation->getValue());
        }

        // Activation mail sending
        if (parent::add($userRegisterForm, $values)) {
            $config = \Zend_Registry::get('config');
            $translate = \Zend_Registry::get('Zend_Translate');

            // Activation link construction
            $router = \Zend_Controller_Front::getInstance()->getRouter();
            $route = $router->getRoute('activate');
            $key = md5(uniqid(rand(), true));
            $link = $config->app->url . '/' . $route->assemble(array('key' => $key));

            $body = str_replace(
                '%link%',
                $link,
                $translate->translate('userEmailRegistrationBody')
            );

            $mail = new \Zend_Mail();
            $mail->setFrom($config->app->admin->email, $config->app->admin->name);
            $mail->addTo(
                $userRegisterForm->getElement('email')->getValue(),
                $userRegisterForm->getElement('firstname')->getValue() . ' ' . $userRegisterForm->getElement('lastname')->getValue()
            );
            $mail->setSubject($translate->translate('userEmailRegistrationSubject'));
            $mail->setBodyText($body);
            $mail->send();

            $user = $userRegisterForm->getEntity();
            $user->setActivation($key);
            $this->_em->flush();

            return true;
        } else {
            return false;
        }
    }

    public function update(UserProfileForm $userProfileForm)
    {
        $currentPassword = $userProfileForm->getEntity()->getPassword();

        $password = $userProfileForm->getElement('password');
        $passwordConfirmation = $userProfileForm->getElement('passwordConfirmation');

        $values = array();
        if ('' != $password->getValue()) {
            $values['password'] = md5($password->getValue());
        } else {
            $password->setValue($currentPassword);
        }
        if ('' != $passwordConfirmation->getValue()) {
            $values['passwordConfirmation'] = md5($passwordConfirmation->getValue());
        } else {
            $passwordConfirmation->setValue($currentPassword);
        }

        return parent::update($userProfileForm, $values);
    }

    public function toggleDeactivation(array $usersId)
    {
        foreach ($usersId as $userId) {
            $user = $this->_em->find(
                'Application\\Models\\User',
                $userId
            );

            if (null !== $user) {
                $user->setIsActive(!$user->getIsActive());

                $this->_em->persist($user);
                $this->_em->flush();
            }
        }
    }

    public function deleteBank(BankModel $bank)
    {
        $bankService = BankService::getInstance();

        $currentUser = $this->getCurrentUser();
        if ($bank->getUser()->getUserId() == $currentUser->getUserId()) {
            $bankService->delete($bank);
        }
    }

    public function deleteAccount(AccountModel $account)
    {
        $accountService = AccountService::getInstance();

        $currentUser = $this->getCurrentUser();
        if ($account->getBank()->getUser()->getUserId() == $currentUser->getUserId()) {
            $accountService->delete($account);
        }
    }

    public function getForgotPasswordForm(array $params = null)
    {
        $userForgotPasswordForm = new UserForgotPasswordForm();
        $userForgotPasswordForm->populate($params);

        return $userForgotPasswordForm;
    }

    /**
     * Sends email with reset password link
     *
     * @param  string $email    user email
     * @return boolean
     */
    public function sendResetPasswordEmail(UserForgotPasswordForm $forgotPasswordForm)
    {
        $isValid = false;

        if ($forgotPasswordForm->isValid($forgotPasswordForm->getValues())) {
            $user = $this->_em->getRepository('Application\\Models\\User')
                              ->findOneBy(array('_email' => $forgotPasswordForm->getElement('email')->getValue()));

            $translate = \Zend_Registry::get('Zend_Translate');

            if (null !== $user) {
                $config = \Zend_Registry::get('config');

                // Reset password link construction
                $router = \Zend_Controller_Front::getInstance()->getRouter();
                $route = $router->getRoute('resetPassword');
                $key = $this->_createResetPasswordKey($user);
                $link = $config->app->url . '/' . $route->assemble(array('key' => $key));

                // Mail sending
                $body = str_replace(
                    '%link%',
                    $link,
                    $translate->translate('userEmailResetPasswordBody')
                );

                $mail = new \Zend_Mail();
                $mail->setFrom($config->app->admin->email, $config->app->admin->name);
                $mail->addTo(
                    $user->getEmail(),
                    $user->getFirstname() . ' ' . $user->getLastname()
                );
                $mail->setSubject($translate->translate('userEmailResetPasswordSubject'));
                $mail->setBodyText($body);
                $mail->send();

                $isValid = true;
            } else {
                $forgotPasswordForm->addErrorMessage($translate->translate('userForgotPasswordFormError'));
            }
        }

        return $isValid;
    }

    /**
     * Returns reset password form if key is valid
     *
     * @param  string $key       reset key
     * @param  string $params    form parameters values
     * @return UserResetPasswordForm
     */
    public function getResetPasswordForm($key, array $params = array())
    {
        if (null !== $this->_decodeResetPasswordKey($key)) {
            $form = new UserResetPasswordForm();
            $form->populate($params);
            return $form;
        }
    }

    /**
     * Updates user password
     *
     * @param  string $key         reset key
     * @param  string $password    password to set
     * @return void
     */
    public function resetPassword(UserResetPasswordForm $resetPasswordForm, $key)
    {
        $isValid = false;

        if ($resetPasswordForm->isValid($resetPasswordForm->getValues())) {
            if (null !== ($user = $this->_decodeResetPasswordKey($key))) {
                $user->setPassword(md5($resetPasswordForm->getElement('password')->getValue()));
                $this->_em->persist($user);
                $this->_em->flush();

                $isValid = true;
            } else {
                $translate = \Zend_Registry::get('Zend_Translate');
                $resetPasswordForm->addErrorMessage($translate->translate('userResetPasswordFormError'));
            }
        }

        return $isValid;
    }

    /**
     * Creates reset password key
     *
     * @param  UserModel $user    user model
     * @return string
     */
    protected function _createResetPasswordKey(UserModel $user)
    {
        $key = base64_encode(gzdeflate(
            $user->getEmail() . '-' . md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601))
        ));

        return $key;
    }

    /**
     * Decodes reset password key and return user model
     *
     * @param  string $key    reset key
     * @return UserModel
     */
    protected function _decodeResetPasswordKey($key)
    {
        if (false !== ($key = gzinflate(base64_decode($key)))) {
            $email = substr($key, 0, -33);
            $md5 = substr($key, -32);

            $user = $this->_em->getRepository('Application\\Models\\User')
                              ->findOneBy(array('_email' => $email));

            if (null !== $user) {
                if (md5($user->getUserId() . '-' . $user->getCreatedAt()->format(\DateTime::ISO8601)) == $md5) {
                    return $user;
                }
            }
        }
    }

    /**
     * Attempts to connect user
     *
     * @return boolean
     */
    public function login(UserLoginForm $userLoginForm)
    {
        $isValid = false;

        if ($userLoginForm->isValid($userLoginForm->getValues())) {
            $adapter = new \Bagheera_Auth_Adapter_Database(
                $userLoginForm->getElement('email')->getValue(),
                $userLoginForm->getElement('password')->getValue()
            );
            $auth = \Zend_Auth::getInstance();
            $result = $auth->authenticate($adapter);

            $isValid = $result->isValid();

            if (!$isValid) {
                $translate = \Zend_Registry::get('Zend_Translate');
                $userLoginForm->addErrorMessage($translate->translate('userLoginError'));
            }
        }

        return $isValid;
    }

    /**
     * Logs out current user
     *
     * @return void
     */
    public function logout()
    {
        \Zend_Auth::getInstance()->clearIdentity();
    }

    /**
     * Returns true if the user is connected
     *
     * @return boolean
     */
    public function hasIdentity()
    {
        return \Zend_Auth::getInstance()->hasIdentity();
    }

    /**
     * Returns the current user identity
     *
     * @return mixed|null
     */
    public function getCurrentUser()
    {
        if ($this->hasIdentity()) {
            return $this->_em->find('Application\\Models\\User', \Zend_Auth::getInstance()->getIdentity());
        }
    }

    /**
     * Activates the user
     *
     * @return boolean
     */
    public function activate($key)
    {
        $user = $this->_em->getRepository('Application\\Models\\User')
                          ->findOneBy(array('_activation' => $key));
        if (null !== $user) {
            $user->setIsActive(true);
            $user->setActivation(null);
            $this->_em->persist($user);
            $this->_em->flush();

            return true;
        }

        return false;
    }

    public function getUsers(UserModel $user = null, $page = 1)
    {
        $dql = 'SELECT u ';
        $dql.= 'FROM Application\\Models\\User u ';
        $dql.= 'WHERE 1 = 1 ';
        if (null !== $user) {
            if ('' != $user->getFirstname()) {
                $dql.= 'AND u._firstname LIKE :firstname ';
            }
            if ('' != $user->getLastname()) {
                $dql.= 'AND u._lastname LIKE :lastname ';
            }
            if ('' != $user->getEmail()) {
                $dql.= 'AND u._email LIKE :email ';
            }
            if ('' != $user->getIsActive()) {
                $dql.= 'AND u._isActive = :isActive ';
            }
            if ('' != $user->getIsAdmin()) {
                $dql.= 'AND u._isAdmin = :isAdmin ';
            }
        }
        $dql.= 'ORDER BY u._createdAt DESC ';
        $query = $this->_em->createQuery($dql);
        if (null !== $user) {
            if ('' != $user->getFirstname()) {
                $query->setParameter('firstname', $user->getFirstname() . '%');
            }
            if ('' != $user->getLastname()) {
                $query->setParameter('lastname', $user->getLastname() . '%');
            }
            if ('' != $user->getEmail()) {
                $query->setParameter('email', $user->getEmail() . '%');
            }
            if ('' != $user->getIsActive()) {
                $query->setParameter('isActive', $user->getIsActive());
            }
            if ('' != $user->getIsAdmin()) {
                $query->setParameter('isAdmin', $user->getIsAdmin());
            }
        }

        $paginator = new \Zend_Paginator(new \DoctrineExtensions\Paginate\PaginationAdapter($query));
        $paginator->setCurrentPageNumber($page);

        return $paginator;
    }
}
