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
 * Label decorator
 *
 * Add a description next to the label
 *
 * @category   Bagheera
 * @package    Bagheera_Form
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class Bagheera_Form_Decorator_Label extends Zend_Form_Decorator_Label
{
    /**
     * Description decorator param
     *
     * @var array
     */
    protected $_description = null;

    /**
     * Label class
     *
     * @var string
     */
    protected $_labelClass = null;

    /**
     * Set the description decorator
     *
     * @param array $description
     * @return Bagheera_Form_Decorator_Label
     */
    public function setDescription(array $description)
    {
        if (empty($description)) {
            $this->_description = null;
        } else {
            $this->_description = $description;
        }

        $this->removeOption('description');

        return $this;
    }

    /**
     * Get the description decorator
     *
     * @return Zend_Form_Decorator_Description
     */
    public function getDescription()
    {
        if (null === $this->_description) {
            $description = $this->getOption('description');
            if (null !== $description) {
                $this->removeOption('description');
                $this->setDescription($description);
            }
            return $description;
        }

        return $this->_description;
    }

    /**
     * Set the label class
     *
     * @param string $labelClass
     * @return Bagheera_Form_Decorator_Label
     */
    public function setLabelClass($labelClass)
    {
        if (empty($labelClass)) {
            $this->_labelClass = null;
        } else {
            $this->_labelClass = $labelClass;
        }

        $this->removeOption('labelClass');

        return $this;
    }

    /**
     * Get the label class
     *
     * @return string
     */
    public function getLabelClass()
    {
        if (null === $this->_labelClass) {
            $labelClass = $this->getOption('labelClass');
            if (null !== $labelClass) {
                $this->removeOption('labelClass');
                $this->setLabelClass($labelClass);
            }
            return $labelClass;
        }

        return $this->_labelClass;
    }

    /**
     * @see Zend_Form_Decorator_Label::render()
     */
    public function render($content)
    {
        $element = $this->getElement();
        $view    = $element->getView();
        if (null === $view) {
            return $content;
        }

        $label       = $this->getLabel();
        $separator   = $this->getSeparator();
        $placement   = $this->getPlacement();
        $tag         = $this->getTag();
        $id          = $this->getId();
        $class       = $this->getClass();
        $description = $this->getDescription();
        $labelClass  = $this->getLabelClass();
        $options     = $this->getOptions();


        if (empty($label) && empty($tag)) {
            return $content;
        }

        if (!empty($label)) {
            $options['class'] = $class;
            $label = $view->formLabel($element->getFullyQualifiedName(), trim($label), $options);
        } else {
            $label = '&#160;';
        }

        if (null !== $description) {
            $decorator = new Zend_Form_Decorator_Description($description);
            $decorator->setElement($element);

            $label = str_replace('</label>', $decorator->render('') . '</label>', $label);
        }

        if (null !== $tag) {
            $options = array('tag' => $tag);
            if (null !== $labelClass) {
                $options['class'] = $labelClass;
            }

            $decorator = new Zend_Form_Decorator_HtmlTag();
            $decorator->setOptions($options);

            $label = $decorator->render($label);
        }

        switch ($placement) {
            case self::APPEND:
                return $content . $separator . $label;
            case self::PREPEND:
                return $label . $separator . $content;
        }
    }
}
