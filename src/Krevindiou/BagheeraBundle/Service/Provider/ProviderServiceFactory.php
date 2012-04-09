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

use Symfony\Component\DependencyInjection\Container,
    Krevindiou\BagheeraBundle\Entity\Bank;

/**
 * Provider service factory
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class ProviderServiceFactory
{
    /**
     * @var Container
     */
    protected $_container;


    public function __construct(Container $container)
    {
        $this->_container = $container;
    }

    public function get(Bank $bank)
    {
        if (1 == $bank->getProviderId()) {
            return $this->_container->get('bagheera.provider_axa_banque');
        }
    }
}
