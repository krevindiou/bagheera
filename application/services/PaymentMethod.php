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

namespace Application\Services;

/**
 * PaymentMethod service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class PaymentMethod extends CrudAbstract
{
    public function getPaymentMethods($type = null)
    {
        if (!in_array($type, array('debit', 'credit', null))) {
            throw new Exception(sprintf('Unknown type "%s"', $type));
        }

        $dql = 'SELECT p FROM Application\\Models\\PaymentMethod p ';
        if (null !== $type) {
            $dql.= 'WHERE p._type = :type ';
        }
        $dql.= 'ORDER BY p._name ASC ';

        $q = $this->_em->createQuery($dql);
        if (null !== $type) {
            $q->setParameter('type', $type);
        }
        return $q->getResult();
    }
}
