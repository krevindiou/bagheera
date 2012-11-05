<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
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
