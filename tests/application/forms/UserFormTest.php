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

require_once __DIR__ . '/../../ControllerTestCase.php';

class UserFormTest extends ControllerTestCase
{
    private $_userService;

    public function setUp()
    {
        parent::setUp();
        $this->_userService = Application\Services\User::getInstance();
    }

    public function getFormValues()
    {
        $formValues = array(
            'firstname' => 'a',
            'lastname' => 'a',
            'email' => 'aaa@aaa.com',
            'password' => 'aaaa',
            'passwordConfirmation' => 'aaaa',
        );

        return $formValues;
    }

    public function testValidators()
    {
        $user = new Application\Models\User();

        $userProfileForm = $this->_userService->getProfileForm($user->getUserId());

        $this->assertFalse($userProfileForm->isValid(array()));

        $formValues = $this->getFormValues();
        $this->assertTrue($userProfileForm->isValid($formValues));

        $formValues = $this->getFormValues();
        $formValues['email'] = 'a';
        $this->assertFalse($userProfileForm->isValid($formValues));

        $formValues = $this->getFormValues();
        $formValues['password'] = 'a';
        $formValues['passwordConfirmation'] = 'a';
        $this->assertFalse($userProfileForm->isValid($formValues));

        $formValues = $this->getFormValues();
        $formValues['password'] = 'aaaa';
        $formValues['passwordConfirmation'] = 'bbbb';
        $this->assertFalse($userProfileForm->isValid($formValues));
    }
}
