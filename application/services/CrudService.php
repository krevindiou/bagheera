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

/**
 * CRUD service
 *
 * @category   Application
 * @package    Application_Services
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
abstract class CrudService extends ServicesAbstract
{
    /**
     * Fetches form with data
     *
     * @param  Bagheera_Form $form    Form to populate
     * @param  object $entity         Entity to get values from
     * @param  array $params          Extra params to get values from
     * @return Bagheera_Form          Form with data
     */
    public function getForm(\Bagheera_Form $form, $entity, array $params = null)
    {
        $form->setEntity($entity);

        foreach ($form->getElements() as $element) {
            if (!isset($params[$element->getName()])) {
                $getter = 'get' . ucfirst($element->getName());
                if (is_callable(array($entity, $getter))) {
                    $value = $entity->$getter();
                    $params[$element->getName()] = $value;
                }
            }
        }

        $form->populate($params);

        return $form;
    }

    /**
     * Adds entity to database
     *
     * @param  Bagheera_Form $form    Form to get values from
     * @return boolean                Success
     */
    public function add(\Bagheera_Form $form)
    {
        if ($form->isValid($form->getValues())) {
            $entity = $form->getEntity();

            foreach ($form->getElements() as $element) {
                $setter = 'set' . ucfirst($element->getName());
                if (is_callable(array($entity, $setter))) {
                    $entity->$setter($element->getValue());
                }
            }

            $entity->setCreatedAt(new \DateTime);
            $entity->setUpdatedAt(new \DateTime);

            $this->_em->persist($entity);
            $this->_em->flush();

            return true;
        } else {
            return false;
        }
    }

    /**
     * Updates entity to database
     *
     * @param  Bagheera_Form $form    Form to get values from
     * @return boolean                Success
     */
    public function update(\Bagheera_Form $form)
    {
        if ($form->isValid($form->getValues())) {
            $entity = $form->getEntity();

            foreach ($form->getElements() as $element) {
                $setter = 'set' . ucfirst($element->getName());
                if (is_callable(array($entity, $setter))) {
                    $entity->$setter($element->getValue());
                }
            }

            $entity->setUpdatedAt(new \DateTime);

            $this->_em->persist($entity);
            $this->_em->flush();

            return true;
        } else {
            return false;
        }
    }

    /**
     * Removes entity from database
     *
     * @param  object $entity    Entity to remove
     * @return void
     */
    public function delete($entity)
    {
        $this->_em->remove($entity);
        $this->_em->flush();
    }
}
