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

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM,
    Symfony\Component\Validator\Constraints as Assert;

/**
 * Krevindiou\BagheeraBundle\Entity\BankAccess
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="bank_access")
 * @ORM\HasLifecycleCallbacks()
 */
class BankAccess
{
    /**
     * @var integer $bankId
     *
     * @ORM\Column(name="bank_id", type="integer")
     * @ORM\Id
     */
    protected $bankId;

    /**
     * @var string $plainLogin
     *
     * @Assert\NotBlank()
     * @Assert\Length(max = 255)
     */
    protected $plainLogin;

    /**
     * @var string $plainPassword
     *
     * @Assert\NotBlank()
     * @Assert\Length(max = 255)
     */
    protected $plainPassword;

    /**
     * @var string $login
     *
     * @ORM\Column(name="login", type="string", length=255)
     */
    protected $login;

    /**
     * @var string $password
     *
     * @ORM\Column(name="password", type="string", length=255)
     */
    protected $password;

    /**
     * @var DateTime $createdAt
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     * @Assert\DateTime()
     */
    protected $createdAt;

    /**
     * @var DateTime $updatedAt
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     * @Assert\DateTime()
     */
    protected $updatedAt;


    /**
     * @ORM\PrePersist
     */
    public function prePersist()
    {
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\PreUpdate
     */
    public function preUpdate()
    {
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * Set bankId
     *
     * @param integer $bankId
     */
    public function setBankId($bankId)
    {
        $this->bankId = $bankId;
    }

    /**
     * Get bankId
     *
     * @return integer
     */
    public function getBankId()
    {
        return $this->bankId;
    }

    /**
     * Set plainLogin
     *
     * @param string $plainLogin
     */
    public function setPlainLogin($plainLogin)
    {
        $this->plainLogin = $plainLogin;
    }

    /**
     * Get plainLogin
     *
     * @return string
     */
    public function getPlainLogin()
    {
        return $this->plainLogin;
    }

    /**
     * Set plainPassword
     *
     * @param string $plainPassword
     */
    public function setPlainPassword($plainPassword)
    {
        $this->plainPassword = $plainPassword;
    }

    /**
     * Get plainPassword
     *
     * @return string
     */
    public function getPlainPassword()
    {
        return $this->plainPassword;
    }

    /**
     * Set login
     *
     * @param string $login
     */
    public function setLogin($login)
    {
        $this->login = $login;
    }

    /**
     * Get login
     *
     * @return string
     */
    public function getLogin()
    {
        return $this->login;
    }

    /**
     * Set password
     *
     * @param string $password
     */
    public function setPassword($password)
    {
        $this->password = $password;
    }

    /**
     * Get password
     *
     * @return string
     */
    public function getPassword()
    {
        return $this->password;
    }

    /**
     * Set createdAt
     *
     * @param DateTime $createdAt
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->createdAt = $createdAt;
    }

    /**
     * Get createdAt
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->createdAt;
    }

    /**
     * Set updatedAt
     *
     * @param DateTime $updatedAt
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * Get updatedAt
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }
}
