<?php

declare(strict_types=1);

namespace App\Service\Provider;

class ArrayConverter
{
    /**
     * Converts string data to an array.
     *
     * @param string $content Data to convert
     * @param string $format  Either QIF, OFX or QFX
     *
     * @return array
     */
    public static function convertFromFormat(string $content, string $format)
    {
        $method = 'self::convertFrom'.ucfirst(strtolower($format));

        if (is_callable($method)) {
            return forward_static_call_array(
                $method,
                ['content' => $content]
            );
        }

        throw new \InvalidArgumentException(sprintf('Invalid format argument "%s"', $format));
    }

    private static function convertFromQif(string $content)
    {
        $data = [];

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

    private static function convertFromOfx(string $content)
    {
        // @todo
        return [];
    }

    private static function convertFromQfx(string $content)
    {
        // @todo
        return [];
    }
}
