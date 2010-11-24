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

class UserResetPasswordTest extends ControllerTestCase
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
            'password' => 'aaaa',
            'passwordConfirmation' => 'aaaa',
        );

        return $formValues;
    }

    public function testValidators()
    {
        $user = new Application\Models\User();

        $key = base64_encode(gzdeflate(
            'john@example.net-' . md5('1-2010-10-03T20:53:46+0000')
        ));
        $userResetPasswordForm = $this->_userService->getResetPasswordForm($key);

        $this->assertFalse($userResetPasswordForm->isValid(array()));

        $formValues = $this->getFormValues();
        $this->assertTrue($userResetPasswordForm->isValid($formValues));

        $formValues = $this->getFormValues();
        $formValues['password'] = 'bbbb';
        $this->assertFalse($userResetPasswordForm->isValid($formValues));
    }
}
