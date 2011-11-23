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

class OperationController extends Controller
{
    /**
     * @Route("/operations", name="operation_list")
     * @Template()
     */
    public function listAction()
    {
        return array();
    }

    /**
     * @Route("/edit-operation-{operationId}", requirements={"operationId" = "\d+"}, name="operation_edit")
     * @Route("/new-operation", name="operation_new")
     * @Template()
     */
    public function saveAction($operationId = null)
    {
        return array();
    }
}
