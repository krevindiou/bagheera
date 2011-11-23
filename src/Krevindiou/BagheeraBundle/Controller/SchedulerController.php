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

class SchedulerController extends Controller
{
    /**
     * @Route("/schedulers", name="scheduler_list")
     * @Template()
     */
    public function listAction()
    {
        return array();
    }

    /**
     * @Route("/edit-scheduler-{schedulerId}", requirements={"schedulerId" = "\d+"}, name="scheduler_edit")
     * @Route("/new-scheduler", name="scheduler_new")
     * @Template()
     */
    public function saveAction($schedulerId = null)
    {
        return array();
    }
}
