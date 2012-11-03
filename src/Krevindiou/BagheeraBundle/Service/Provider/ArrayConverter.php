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

namespace Krevindiou\BagheeraBundle\Service\Provider;

/**
 * Array converter
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class ArrayConverter
{
    /**
     * Converts string data to an array
     *
     * @param  string $content Data to convert
     * @param  string $format  Either QIF, OFX or QFX
     * @return array
     */
    public static function convertFromFormat($content, $format)
    {
        $method = 'self::_convertFrom' . ucfirst(strtolower($format));

        if (is_callable($method)) {
            return forward_static_call_array(
                $method,
                array('content' => $content)
            );
        }

        throw new InvalidArgumentException(sprintf('Invalid format argument "%s"', $format));
    }

    private static function _convertFromQif($content)
    {
        $data = array();

        if (preg_match_all(
            '#(.*?)[\r\n]{1,2}\^#s',
            $content,
            $operations
        )) {
            foreach ($operations[0] as $k => $operation) {
                if (preg_match_all('#^(?P<prefix>[a-z])(?P<value>.*?)[\r\n]*$#mi', trim($operation), $operationValues)) {
                    foreach ($operationValues[0] as $k2 => $operationValue) {
                        $data[$k][$operationValues['prefix'][$k2]] = $operationValues['value'][$k2];
                    }
                }
            }
        }

        return $data;
    }

    private static function _convertFromOfx($content)
    {
        $data = array();

        // @todo
        return $data;
    }

    private static function _convertFromQfx($content)
    {
        $data = array();

        // @todo
        return $data;
    }
}
