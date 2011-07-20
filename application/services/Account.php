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

use Application\Models\Account as AccountModel,
    Application\Forms\Account as AccountForm;

/**
 * Account service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Account extends CrudAbstract
{
    public function getForm(AccountModel $account = null, array $extraValues = null)
    {
        if (null === $account) {
            $account = new AccountModel();
        }

        return parent::getForm(new AccountForm(), $account, $extraValues);
    }

    public function save(AccountForm $accountForm)
    {
        $details = $accountForm->getElement('details');
        $details->receive();

        $currentDetails = $accountForm->getEntity()->getDetails();

        if ('' != $accountForm->getElement('accountId')->getValue()) {
            $values = array();
            if ('' == $details->getValue()) {
                $values['details'] = $currentDetails;
            }

            return parent::update($accountForm, $values);
        } else {
            return parent::add($accountForm);
        }
    }

    public function delete(AccountModel $account)
    {
        return parent::delete($account);
    }
}
