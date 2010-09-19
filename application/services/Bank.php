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

use Application\Models\Bank as BankModel,
    Application\Forms\Bank as BankForm;

/**
 * Bank service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Bank extends CrudAbstract
{
    public function getForm($bankId = null, array $params = null)
    {
        if (null !== $bankId) {
            $bank = $this->_em->find('Application\\Models\\Bank', $bankId);
        } else {
            $bank = new BankModel();
        }

        return parent::getForm(new BankForm, $bank, $params);
    }

    public function add(BankForm $bankForm)
    {
        return parent::add($bankForm);
    }

    public function update(BankForm $bankForm)
    {
        return parent::update($bankForm);
    }

    public function delete(BankModel $bank)
    {
        return parent::delete($bank);
    }
}
