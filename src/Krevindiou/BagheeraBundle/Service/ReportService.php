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

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Report,
    Krevindiou\BagheeraBundle\Form\ReportForm;

/**
 * Report service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class ReportService
{
    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var FormFactory
     */
    protected $_formFactory;


    public function __construct(Logger $logger, EntityManager $em, FormFactory $formFactory)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
    }

    /**
     * Returns reports list
     *
     * @param  User $user User entity
     * @return Doctrine\Common\Collections\Collection
     */
    public function getList(User $user)
    {
        return $user->getReports();
    }

    /**
     * Returns report form
     *
     * @param  User $user       User entity
     * @param  Report $report   Report entity
     * @param  string $type     Report type (sum, average, distribution, estimate)
     * @return Form
     */
    public function getForm(User $user, Report $report = null, $type = null)
    {
        if (null === $report) {
            $report = new Report();
            $report->setUser($user);
            $report->setType($type);
        } elseif ($user !== $report->getUser()) {
            return;
        }

        $form = $this->_formFactory->create(new ReportForm(), $report);

        return $form;
    }

    /**
     * Saves report
     *
     * @param  User $user     User entity
     * @param  Report $report Report entity
     * @return boolean
     */
    protected function _save(User $user, Report $report)
    {
        if ($user === $report->getUser()) {
            try {
                $this->_em->persist($report);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Saves report
     *
     * @param  User $user     User entity
     * @param  Report $report Report entity
     * @return boolean
     */
    public function save(User $user, Report $report)
    {
        $errors = $this->_validator->validate($report);

        if (0 == count($errors)) {
            return $this->_save($user, $report);
        }

        return false;
    }

    /**
     * Saves report form
     *
     * @param  User $user User entity
     * @param  Form $form Report form
     * @return boolean
     */
    public function saveForm(User $user, Form $form)
    {
        if ($form->isValid()) {
            return $this->_save($user, $form->getData());
        }

        return false;
    }

    /**
     * Deletes reports
     *
     * @param  User $user       User entity
     * @param  array $reportsId Reports id to delete
     * @return boolean
     */
    public function delete(User $user, array $reportsId)
    {
        try {
            foreach ($reportsId as $reportId) {
                $report = $this->_em->find('KrevindiouBagheeraBundle:Report', $reportId);

                if (null !== $report) {
                    if ($user === $report->getUser()) {
                        $this->_em->remove($report);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());

            return false;
        }

        return true;
    }
}
