<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\Security\Core\SecurityContext;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
use JMS\SecurityExtraBundle\Annotation\Secure;
use Krevindiou\BagheeraBundle\Entity\User;

class UserController extends Controller
{
    /**
     * @Template
     */
    public function loginAction(Request $request)
    {
        $session = $request->getSession();

        // Get the login error if there is one
        if ($request->attributes->has(SecurityContext::AUTHENTICATION_ERROR)) {
            $error = $request->attributes->get(SecurityContext::AUTHENTICATION_ERROR);
        } else {
            $error = $session->get(SecurityContext::AUTHENTICATION_ERROR);
        }

        return array(
            'last_username' => $session->get(SecurityContext::LAST_USERNAME),
            'error' => $error,
        );
    }

    /**
     * @Route("/register", name="user_register")
     * @Template
     */
    public function registerAction(Request $request)
    {
        $form = $this->get('bagheera.user')->getRegisterForm($request->getPreferredLanguage());

        if ($request->getMethod() == 'POST') {
            $form->bind($request);

            if ($this->get('bagheera.user')->saveForm($form)) {
                $this->get('session')->getFlashBag()->add('success', 'user_register_confirmation');

                return $this->redirect($this->generateUrl('login'));
            }
        }

        return array(
            'registerForm' => $form->createView()
        );
    }

    /**
     * @Route("/forgot-password", name="user_forgot_password")
     * @Template
     */
    public function forgotPasswordAction(Request $request)
    {
        $form = $this->get('bagheera.user')->getForgotPasswordForm();

        if ($request->getMethod() == 'POST') {
            $form->bind($request);

            if ($form->isValid()) {
                $data = $form->getData();

                if ($this->get('bagheera.user')->sendResetPasswordEmail($data['email'])) {
                    $this->get('session')->getFlashBag()->add('info', 'user_forgot_password_confirmation');

                    return $this->redirect($this->generateUrl('login'));
                }
            }
        }

        return array(
            'forgotPasswordForm' => $form->createView()
        );
    }

    /**
     * @Route("/reset-password", name="user_reset_password")
     * @Template
     */
    public function resetPasswordAction(Request $request)
    {
        $key = $request->query->get('key');

        $form = $this->get('bagheera.user')->getResetPasswordForm($key);

        if (null !== $form) {
            if ($request->getMethod() == 'POST') {
                $form->bind($request);

                if ($form->isValid()) {
                    $data = $form->getData();

                    if ($this->get('bagheera.user')->resetPassword($data['password'], $key)) {
                        $this->get('session')->getFlashBag()->add('success', 'user_reset_password_confirmation');

                        return $this->redirect($this->generateUrl('login'));
                    }
                }
            }
        } else {
            $this->get('session')->getFlashBag()->add('error', 'user_reset_password_error');

            return $this->redirect($this->generateUrl('login'));
        }

        return array(
            'key' => $key,
            'resetPasswordForm' => $form->createView()
        );
    }

    /**
     * @Route("/activate", name="user_activate")
     */
    public function activateAction(Request $request)
    {
        $key = $request->query->get('key');

        if ('' != $key && $this->get('bagheera.user')->activate($key)) {
            $this->get('session')->getFlashBag()->add('success', 'user_register_activation_confirmation');
        } else {
            $this->get('session')->getFlashBag()->add('error', 'user_register_activation_error');
        }

        return $this->redirect($this->generateUrl('login'));
    }

    /**
     * @Route("/profile", name="user_profile")
     * @Template
     */
    public function profileAction(Request $request)
    {
        $form = $this->get('bagheera.user')->getProfileForm($this->getUser());

        if ($request->getMethod() == 'POST') {
            $form->bind($request);

            if ($this->get('bagheera.user')->saveForm($form)) {
                $this->get('session')->getFlashBag()->add('success', 'user_profile_confirmation');

                return $this->redirect($this->generateUrl('user_profile'));
            }
        }

        return array(
            'profileForm' => $form->createView()
        );
    }

    /**
     * @Route("/users", name="user_list")
     * @Template
     * @Secure(roles="ROLE_ADMIN")
     */
    public function listAction(Request $request)
    {
        $page = $request->query->getInt('page', 1);
        $users = (array) $request->request->get('users');

        if (!empty($users)) {
            if ($request->request->get('toggleDeactivation')) {
                $this->get('bagheera.user')->toggleDeactivation($users);
                $this->get('session')->getFlashBag()->add('success', 'user_toggle_deactivation_ok');
            }

            return $this->redirect($this->generateUrl('user_list', array('page' => $page)));
        }

        return array(
            'users' => $this->get('bagheera.user')->getUsers(array(), $page)
        );
    }
}
