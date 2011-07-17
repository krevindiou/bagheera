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
    public function getForm(BankModel $bank = null, array $extraValues = null)
    {
        if (null === $bank) {
            $bank = new BankModel();
        }

        return parent::getForm(new BankForm(), $bank, $extraValues);
    }

    public function save(BankForm $bankForm)
    {
        $userService = User::getInstance();

        $values = array(
            'user' => $userService->getCurrentUser()
        );

        if ('' != $bankForm->getElement('bankId')->getValue()) {
            return parent::update($bankForm, $values);
        } else {
            return parent::add($bankForm, $values);
        }
    }

    public function delete(BankModel $bank)
    {
        return parent::delete($bank);
    }
}
