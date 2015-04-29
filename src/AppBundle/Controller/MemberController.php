<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\Security\Core\SecurityContext;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

class MemberController extends Controller
{
    /**
     * @Route("/sign-in", name="member_login")
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
            $session->remove(SecurityContext::AUTHENTICATION_ERROR);
        }

        return [
            'last_username' => $session->get(SecurityContext::LAST_USERNAME),
            'error' => $error,
        ];
    }

    /**
     * @Route("/register", name="member_register")
     * @Template
     */
    public function registerAction(Request $request)
    {
        $form = $this->get('app.member')->getRegisterForm($request->getPreferredLanguage());

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($this->get('app.member')->saveForm($form)) {
                $this->get('session')->getFlashBag()->add('success', 'member.register.confirmation');

                return $this->redirect($this->generateUrl('member_login'));
            }
        }

        return [
            'registerForm' => $form->createView(),
        ];
    }

    /**
     * @Route("/forgot-password", name="member_forgot_password")
     * @Template
     */
    public function forgotPasswordAction(Request $request)
    {
        $form = $this->get('app.member')->getForgotPasswordForm();

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($form->isValid()) {
                if ($this->get('app.member')->sendChangePasswordEmail($form->get('email')->getData())) {
                    $this->get('session')->getFlashBag()->add('info', 'member.forgot_password.confirmation');

                    return $this->redirect($this->generateUrl('member_login'));
                }
            }
        }

        return [
            'forgotPasswordForm' => $form->createView(),
        ];
    }

    /**
     * @Route("/change-password", name="member_change_password_public", requirements={"key"})
     * @Template
     */
    public function changePasswordPublicAction(Request $request)
    {
        $key = $request->query->get('key');

        if ($member = $this->get('app.member')->decodeChangePasswordKey($key)) {
            $form = $this->get('app.member')->getChangePasswordForm();

            $form->handleRequest($request);

            if ($form->isSubmitted()) {
                if ($form->isValid()) {
                    if ($this->get('app.member')->changePassword($member, $form->get('password')->getData())) {
                        $this->get('session')->getFlashBag()->add('success', 'member.change_password.confirmation');

                        return $this->redirect($this->generateUrl('member_login'));
                    }
                }
            }
        } else {
            return $this->redirect($this->generateUrl('member_login'));
        }

        return [
            'key' => $key,
            'changePasswordForm' => $form->createView(),
        ];
    }

    /**
     * @Route("/manager/change-password", name="member_change_password")
     * @Template
     */
    public function changePasswordAction(Request $request)
    {
        $form = $this->get('app.member')->getChangePasswordForm();

        if ($request->getMethod() == 'POST') {
            $form->handleRequest($request);

            if ($form->isSubmitted()) {
                if ($this->get('app.member')->changePassword($this->getUser(), $form->get('password')->getData())) {
                    $this->get('session')->getFlashBag()->add('success', 'member.change_password.confirmation');

                    return $this->redirect($this->generateUrl($request->get('_route')));
                }
            }
        }

        return [
            'changePasswordForm' => $form->createView(),
        ];
    }

    /**
     * @Route("/activate", name="member_activate")
     */
    public function activateAction(Request $request)
    {
        $key = $request->query->get('key');

        if (null !== $key && $this->get('app.member')->activate($key)) {
            $this->get('session')->getFlashBag()->add('success', 'member.register.activation_confirmation');
        } else {
            $this->get('session')->getFlashBag()->add('error', 'member.register.activation_error');
        }

        return $this->redirect($this->generateUrl('member_login'));
    }

    /**
     * @Route("/manager/profile", name="member_profile")
     * @Template
     */
    public function profileAction(Request $request)
    {
        $form = $this->get('app.member')->getProfileForm($this->getUser());

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($this->get('app.member')->saveForm($form)) {
                $this->get('session')->getFlashBag()->add('success', 'member.profile.confirmation');

                return $this->redirect($this->generateUrl('member_profile'));
            }
        }

        return [
            'profileForm' => $form->createView(),
        ];
    }
}
