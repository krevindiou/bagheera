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

namespace Application\Models\Repositories;

use Doctrine\ORM\EntityRepository;

class BankRepository extends EntityRepository
{
    /**
     * User banks list
     *
     * @var array
     */
    public function getUserBanks(\Application\Models\User $user)
    {
        $dql = 'SELECT b FROM Application\\Models\\Bank b ';
        $dql.= 'JOIN b._user u WITH u = :user ';
        $dql.= 'ORDER BY b._name ASC ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $user);

        return $query->getResult();
    }
}
