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


/**
 * Password confirmation validator
 *
 * @category   Bagheera
 * @package    Bagheera_Validate
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Bagheera_Validate_PasswordConfirmation extends Zend_Validate_Abstract
{
    const DOES_NOT_MATCH = 'userPasswordConfirmationDoesNotMatch';

    protected $_messageTemplates = array(
        self::DOES_NOT_MATCH => 'userPasswordConfirmationDoesNotMatch'
    );

    protected $_fieldsToMatch = array();

    public function __construct($fieldsToMatch = array())
    {
        if (is_array($fieldsToMatch)) {
            foreach ($fieldsToMatch as $field) {
                $this->_fieldsToMatch[] = (string)$field;
            }
        } else {
            $this->_fieldsToMatch[] = (string)$fieldsToMatch;
        }
    }

    public function isValid($value, $context = null)
    {
        $value = (string)$value;
        $this->_setValue($value);

        $error = false;

        foreach ($this->_fieldsToMatch as $fieldName) {
            if (!isset($context[$fieldName]) || $value !== $context[$fieldName]) {
                $error = true;
                $this->_error(self::DOES_NOT_MATCH);
                break;
            }
        }

        return !$error;
    }
}
