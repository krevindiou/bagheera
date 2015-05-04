<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;

class MemberController extends Controller
{
    /**
     * @Route("/sign-in", name="member_login")
     */
    public function loginAction(Request $request)
    {
        $helper = $this->get('security.authentication_utils');

        return $this->render(
            'AppBundle:Member:login.html.twig',
            [
                'last_username' => $helper->getLastUsername(),
                'error' => $helper->getLastAuthenticationError(),
            ]
        );
    }

    /**
     * @Route("/register", name="member_register")
     */
    public function registerAction(Request $request)
    {
        $form = $this->get('app.member')->getRegisterForm($request->getPreferredLanguage());

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($this->get('app.member')->saveForm($form)) {
                $this->addFlash('success', 'member.register.confirmation');

                return $this->redirectToRoute('member_login');
            }
        }

        return $this->render(
            'AppBundle:Member:register.html.twig',
            [
                'registerForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/forgot-password", name="member_forgot_password")
     */
    public function forgotPasswordAction(Request $request)
    {
        $form = $this->get('app.member')->getForgotPasswordForm();

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($form->isValid()) {
                if ($this->get('app.member')->sendChangePasswordEmail($form->get('email')->getData())) {
                    $this->addFlash('info', 'member.forgot_password.confirmation');

                    return $this->redirectToRoute('member_login');
                }
            }
        }

        return $this->render(
            'AppBundle:Member:forgotPassword.html.twig',
            [
                'forgotPasswordForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/change-password", name="member_change_password_public", requirements={"key"})
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
                        $this->addFlash('success', 'member.change_password.confirmation');

                        return $this->redirectToRoute('member_login');
                    }
                }
            }
        } else {
            return $this->redirectToRoute('member_login');
        }

        return $this->render(
            'AppBundle:Member:changePasswordPublic.html.twig',
            [
                'key' => $key,
                'changePasswordForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/manager/change-password", name="member_change_password")
     */
    public function changePasswordAction(Request $request)
    {
        $form = $this->get('app.member')->getChangePasswordForm();

        if ($request->getMethod() == 'POST') {
            $form->handleRequest($request);

            if ($form->isSubmitted()) {
                if ($this->get('app.member')->changePassword($this->getUser(), $form->get('password')->getData())) {
                    $this->addFlash('success', 'member.change_password.confirmation');

                    return $this->redirectToRoute($request->get('_route'));
                }
            }
        }

        return $this->render(
            'AppBundle:Member:changePassword.html.twig',
            [
                'changePasswordForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/activate", name="member_activate")
     */
    public function activateAction(Request $request)
    {
        $key = $request->query->get('key');

        if (null !== $key && $this->get('app.member')->activate($key)) {
            $this->addFlash('success', 'member.register.activation_confirmation');
        } else {
            $this->addFlash('error', 'member.register.activation_error');
        }

        return $this->redirectToRoute('member_login');
    }

    /**
     * @Route("/manager/profile", name="member_profile")
     */
    public function profileAction(Request $request)
    {
        $form = $this->get('app.member')->getProfileForm($this->getUser());

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($this->get('app.member')->saveForm($form)) {
                $this->addFlash('success', 'member.profile.confirmation');

                return $this->redirectToRoute('member_profile');
            }
        }

        return $this->render(
            'AppBundle:Member:profile.html.twig',
            [
                'profileForm' => $form->createView(),
            ]
        );
    }
}