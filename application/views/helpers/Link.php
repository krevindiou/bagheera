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
 * Link helper
 *
 * @category   Application
 * @package    Application_Views
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Application_View_Helper_Link extends Zend_View_Helper_Abstract
{
    /**
     * Generates an html link given the name of a route.
     *
     * @param  mixed $name The name of a Route to use.
     * @param  string $label The link label
     * @param  array $params html parameters list
     * @param  array $urlOptions Options passed to the assemble method of the Route object.
     * @param  bool $reset Whether or not to reset the route defaults with those provided
     * @param  bool $encode Tells to encode URL parts on output
     * @return string html link
     */
    public function link($name, $label, array $params = array(), array $urlOptions = array(), $reset = true, $encode = true)
    {
        $router = Zend_Controller_Front::getInstance()->getRouter();

        $paramsString = '';
        if (!empty($params)) {
            $paramsString.= ' ';
            foreach ($params as $paramName => $paramValue) {
                $paramsString.= $this->view->escape($paramName) . '="' . $this->view->escape($paramValue) . '"';
            }
        }

        return sprintf('<a href="%s"%s>%s</a>',
            $router->assemble($urlOptions, $name, $reset, $encode),
            $paramsString,
            $label
        );
    }
}
