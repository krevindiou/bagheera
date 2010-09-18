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

use Application\Models\Bank,
    Application\Forms\BankForm;

/**
 * Bank service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankService extends CrudService
{
    public function getForm($bankId, array $params = null)
    {
        $bank = $this->_em->find('Application\\Models\\Bank', $bankId);
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

    public function delete(Bank $bank)
    {
        return parent::delete($bank);
    }
}
