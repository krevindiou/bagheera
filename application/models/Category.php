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

namespace Application\Models;

/**
 * Category entity
 *
 * @category   Application
 * @package    Application_Models
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @Entity
 * @Table(name="category")
 */
class Category
{
    /**
     * categoryId attribute
     *
     * @Id @Column(type="integer", name="category_id")
     * @GeneratedValue
     */
    protected $_categoryId;

    /**
     * parentCategoryId attribute
     *
     * @var integer
     * @Column(type="integer", name="parent_category_id")
     */
    protected $_parentCategoryId;

    /**
     * parentCategory attribute
     *
     * @var Application\Models\Category
     * @OneToOne(targetEntity="Category", inversedBy="_subCategories")
     * @JoinColumn(name="parent_category_id", referencedColumnName="category_id")
     */
    protected $_parentCategory;

    /**
     * @OneToMany(targetEntity="Category", mappedBy="_parentCategory")
     */
    protected $_subCategories;

    /**
     * name attribute
     *
     * @var string
     * @Column(type="string", name="name")
     */
    protected $_name;

    /**
     * isActive attribute
     *
     * @var boolean
     * @Column(type="boolean", name="is_active")
     */
    protected $_isActive;

    /**
     * createdAt attribute
     *
     * @var DateTime
     * @Column(type="datetime", name="created_at")
     */
    protected $_createdAt;

    /**
     * updatedAt attribute
     *
     * @var DateTime
     * @Column(type="datetime", name="updated_at")
     */
    protected $_updatedAt;


    public function __construct()
    {
        $this->_subCategories = new \Doctrine\Common\Collections\ArrayCollection();
    }

    /**
     * Gets categoryId
     *
     * @return integer
     */
    public function getCategoryId()
    {
        return $this->_categoryId;
    }

    /**
     * Gets parentCategory
     *
     * @return Application\Models\Category
     */
    public function getParentCategory()
    {
        return $this->_parentCategory;
    }

    /**
     * Sets parentCategory
     *
     * @param  Application\Models\Category $parentCategory    parentCategory to set
     * @return void
     */
    public function setParentCategory(Category $parentCategory)
    {
        $this->_parentCategory = $parentCategory;
    }

    /**
     * Gets subCategories
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getSubCategories()
    {
        return $this->_subCategories;
    }

    /**
     * Gets name
     *
     * @return string
     */
    public function getName()
    {
        return $this->_name;
    }

    /**
     * Sets name
     *
     * @param  string $name    name to set
     * @return void
     */
    public function setName($name)
    {
        $this->_name = $name;
    }

    /**
     * Gets isActive
     *
     * @return boolean
     */
    public function getIsActive()
    {
        return $this->_isActive;
    }

    /**
     * Sets isActive
     *
     * @param  boolean $isActive    isActive to set
     * @return void
     */
    public function setIsActive($isActive)
    {
        $this->_isActive = (bool)$isActive;
    }

    /**
     * Gets createdAt
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->_createdAt;
    }

    /**
     * Sets createdAt
     *
     * @param  DateTime $createdAt    createdAt to set
     * @return void
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->_createdAt = $createdAt;
    }

    /**
     * Gets updatedAt
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->_updatedAt;
    }

    /**
     * Sets updatedAt
     *
     * @param  DateTime $updatedAt    updatedAt to set
     * @return void
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->_updatedAt = $updatedAt;
    }
}
