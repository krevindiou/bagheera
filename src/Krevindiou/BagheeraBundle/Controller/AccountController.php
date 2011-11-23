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
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Route,
    Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

class AccountController extends Controller
{
    /**
     * @Route("/home", name="account_summary")
     * @Template()
     */
    public function summaryAction()
    {
        return array();
    }

    /**
     * @Route("/edit-account-{accountId}", requirements={"accountId" = "\d+"}, name="account_edit")
     * @Route("/new-account", name="account_new")
     * @Template()
     */
    public function saveAction($accountId = null)
    {
        return array();
    }

    /**
     * @Route("/account-details-{accountId}", requirements={"accountId" = "\d+"}, name="account_details")
     * @Template()
     */
    public function detailsAction($accountId)
    {
        return array();
    }
}
