<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\MemberService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

class MemberController extends AbstractController
{
    /**
     * @Route("/sign-in", name="member_login")
     */
    public function login(Request $request, AuthenticationUtils $authenticationUtils)
    {
        return $this->render(
            'Member/login.html.twig',
            [
                'last_username' => $authenticationUtils->getLastUsername(),
                'error' => $authenticationUtils->getLastAuthenticationError(),
            ]
        );
    }

    /**
     * @Route("/register", name="member_register")
     */
    public function register(Request $request, MemberService $memberService)
    {
        $form = $memberService->getRegisterForm($request->getPreferredLanguage());

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($memberService->saveForm($form)) {
                $this->addFlash('success', 'member.register.confirmation');

                return $this->redirectToRoute('member_login');
            }
        }

        return $this->render(
            'Member/register.html.twig',
            [
                'registerForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/forgot-password", name="member_forgot_password")
     */
    public function forgotPassword(Request $request, MemberService $memberService)
    {
        $form = $memberService->getForgotPasswordForm();

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($form->isValid()) {
                if ($memberService->sendChangePasswordEmail($form->get('email')->getData())) {
                    $this->addFlash('info', 'member.forgot_password.confirmation');

                    return $this->redirectToRoute('member_login');
                }
            }
        }

        return $this->render(
            'Member/forgotPassword.html.twig',
            [
                'forgotPasswordForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/change-password/{key}", name="member_change_password_public", requirements={"key" = ".+"})
     */
    public function changePasswordPublic(Request $request, MemberService $memberService, $key)
    {
        if ($member = $memberService->decodeChangePasswordKey($key)) {
            $form = $memberService->getChangePasswordForm();

            $form->handleRequest($request);

            if ($form->isSubmitted()) {
                if ($form->isValid()) {
                    if ($memberService->changePassword($member, $form->get('password')->getData())) {
                        $this->addFlash('success', 'member.change_password.confirmation');

                        return $this->redirectToRoute('member_login');
                    }
                }
            }
        } else {
            return $this->redirectToRoute('member_login');
        }

        return $this->render(
            'Member/changePasswordPublic.html.twig',
            [
                'key' => $key,
                'changePasswordForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/manager/change-password", name="member_change_password")
     */
    public function changePassword(Request $request, MemberService $memberService)
    {
        $form = $memberService->getChangePasswordForm();

        if ('POST' === $request->getMethod()) {
            $form->handleRequest($request);

            if ($form->isSubmitted()) {
                if ($memberService->changePassword($this->getUser(), $form->get('password')->getData())) {
                    $this->addFlash('success', 'member.change_password.confirmation');

                    return $this->redirectToRoute($request->get('_route'));
                }
            }
        }

        return $this->render(
            'Member/changePassword.html.twig',
            [
                'changePasswordForm' => $form->createView(),
            ]
        );
    }

    /**
     * @Route("/activate", name="member_activate")
     */
    public function activate(Request $request, MemberService $memberService)
    {
        $key = $request->query->get('key');

        if (null !== $key && $memberService->activate($key)) {
            $this->addFlash('success', 'member.register.activation_confirmation');
        } else {
            $this->addFlash('error', 'member.register.activation_error');
        }

        return $this->redirectToRoute('member_login');
    }

    /**
     * @Route("/manager/profile", name="member_profile")
     */
    public function profile(Request $request, MemberService $memberService)
    {
        $form = $memberService->getProfileForm($this->getUser());

        $form->handleRequest($request);

        if ($form->isSubmitted()) {
            if ($memberService->saveForm($form)) {
                $this->addFlash('success', 'member.profile.confirmation');

                return $this->redirectToRoute('member_profile');
            }
        }

        return $this->render(
            'Member/profile.html.twig',
            [
                'profileForm' => $form->createView(),
            ]
        );
    }
}
