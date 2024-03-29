<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\MemberService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

class MemberController extends AbstractController
{
    #[Route(path: '/sign-in', name: 'member_login')]
    public function login(Request $request, AuthenticationUtils $authenticationUtils): Response
    {
        return $this->render(
            'Member/login.html.twig',
            [
                'last_username' => $authenticationUtils->getLastUsername(),
                'error' => $authenticationUtils->getLastAuthenticationError(),
            ]
        );
    }

    #[Route(path: '/register', name: 'member_register')]
    public function register(Request $request, MemberService $memberService): Response
    {
        $form = $memberService->getRegisterForm($request->getPreferredLanguage());
        $form->handleRequest($request);
        if ($form->isSubmitted()) {
            if ($memberService->saveRegisterForm($form->getData())) {
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

    #[Route(path: '/forgot-password', name: 'member_forgot_password')]
    public function forgotPassword(Request $request, MemberService $memberService): Response
    {
        $form = $memberService->getForgotPasswordForm();
        $form->handleRequest($request);
        if ($form->isSubmitted()) {
            if ($form->isValid()) {
                if ($memberService->sendChangePasswordEmail($form->getData()->email)) {
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

    #[Route(path: '/change-password/{key}', name: 'member_change_password_public', requirements: ['key' => '.+'])]
    public function changePasswordPublic(Request $request, MemberService $memberService, $key): Response
    {
        try {
            $member = $memberService->decodeChangePasswordKey($key);
        } catch (\Exception $e) {
            return $this->redirectToRoute('member_login');
        }
        $form = $memberService->getChangePasswordForm();
        $form->handleRequest($request);
        if ($form->isSubmitted()) {
            if ($form->isValid()) {
                if ($memberService->changePassword($member, $form->getData()->password)) {
                    $this->addFlash('success', 'member.change_password.confirmation');

                    return $this->redirectToRoute('member_login');
                }
            }
        }

        return $this->render(
            'Member/changePasswordPublic.html.twig',
            [
                'key' => $key,
                'changePasswordForm' => $form->createView(),
            ]
        );
    }

    #[Route(path: '/manager/change-password', name: 'member_change_password')]
    public function changePassword(Request $request, MemberService $memberService): Response
    {
        $form = $memberService->getChangePasswordForm();
        if ('POST' === $request->getMethod()) {
            $form->handleRequest($request);

            if ($form->isSubmitted()) {
                if ($memberService->changePassword($this->getUser(), $form->getData()->password)) {
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

    #[Route(path: '/activate', name: 'member_activate')]
    public function activate(Request $request, MemberService $memberService): Response
    {
        $key = $request->query->get('key');
        if (null !== $key && $memberService->activate($key)) {
            $this->addFlash('success', 'member.register.activation_confirmation');
        } else {
            $this->addFlash('error', 'member.register.activation_error');
        }

        return $this->redirectToRoute('member_login');
    }

    #[Route(path: '/manager/profile', name: 'member_profile')]
    public function profile(Request $request, MemberService $memberService): Response
    {
        $form = $memberService->getProfileForm($this->getUser());
        $form->handleRequest($request);
        if ($form->isSubmitted()) {
            if ($memberService->saveProfileForm($this->getUser(), $form->getData())) {
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
