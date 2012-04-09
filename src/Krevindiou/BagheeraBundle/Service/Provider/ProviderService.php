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

use Symfony\Bridge\Monolog\Logger;

/**
 * Provider service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
abstract class ProviderService implements ProviderServiceInterface
{
    /**
     * @var string
     */
    protected $_baseUri;

    /**
     * @var string
     */
    protected $_clientId;

    /**
     * @var string
     */
    protected $_accessToken;

    /**
     * @var Logger
     */
    protected $_logger;


    public function __construct($baseUri, $clientId, $accessToken, Logger $logger)
    {
        $this->_baseUri = $baseUri;
        $this->_clientId = $clientId;
        $this->_accessToken = $accessToken;
        $this->_logger = $logger;
    }

    protected function _request($uri, array $params = array())
    {
        $uri = sprintf(
            '%s%s?client_id=%s&access_token=%s',
            $this->_baseUri,
            $uri,
            $this->_clientId,
            $this->_accessToken
        );

        foreach ($params as $k => $v) {
            $uri.= '&' . $k . '=' . $v;
        }

        $this->_logger->debug($uri);

        if (false !== ($data = file_get_contents($uri))) {
            if (null !== ($data = json_decode($data))) {
                return $this->_objectToArray($data);
            }
        }
    }

    protected function _objectToArray($object)
    {
        if (!is_object($object) && !is_array($object)) {
            return $object;
        }

        if (is_object($object)) {
            $object = get_object_vars($object);
        }

        return array_map(array($this, __FUNCTION__), $object);
    }
}
