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

class AccountRepository extends EntityRepository
{
    /**
     * User accounts list
     *
     * @var array
     */
    public function getUserAccounts(\Application\Models\User $user)
    {
        $dql = 'SELECT a FROM Application\\Models\\Account a ';
        $dql.= 'JOIN a._bank b ';
        $dql.= 'JOIN b._user u WITH u = :user ';
        $dql.= 'ORDER BY a._name ASC ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $user);

        return $query->getResult();
    }
}
