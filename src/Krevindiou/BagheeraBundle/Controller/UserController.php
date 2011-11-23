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

namespace Krevindiou\BagheeraBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller,
    Symfony\Component\Security\Core\SecurityContext,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template,
    JMS\SecurityExtraBundle\Annotation\Secure;

class UserController extends Controller
{
    /**
     * @Template()
     */
    public function loginAction()
    {
        $request = $this->getRequest();
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
     * @Template()
     */
    public function registerAction()
    {
        return array();
    }

    /**
     * @Route("/forgot-password", name="user_forgot_password")
     * @Template()
     */
    public function forgotPasswordAction()
    {
        return array();
    }

    /**
     * @Route("/reset-password/{key}", name="user_reset_password")
     * @Template()
     */
    public function resetPasswordAction($key)
    {
        return array();
    }

    /**
     * @Route("/activate/{key}", requirements={"key" = "[0-9a-f]{32}"}, name="user_activate")
     * @Template()
     */
    public function activateAction($key)
    {
        return array();
    }

    /**
     * @Route("/profile", name="user_profile")
     * @Template()
     */
    public function profileAction()
    {
        return array();
    }

    /**
     * @Route("/users", name="user_list")
     * @Template()
     * @Secure(roles="ROLE_ADMIN")
     */
    public function listAction()
    {
        return array();
    }

    /**
     * @Route("/edit-user-{userId}", requirements={"userId" = "\d+"}, name="user_edit")
     * @Route("/new-user", name="user_new")
     * @Template()
     * @Secure(roles="ROLE_ADMIN")
     */
    public function saveAction($userId = null)
    {
        return array();
    }
}
