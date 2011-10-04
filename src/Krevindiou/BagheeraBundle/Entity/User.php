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
    Symfony\Component\Security\Core\User\UserInterface,
    Symfony\Component\Validator\Constraints as Assert,
    Symfony\Bridge\Doctrine\Validator\Constraints as DoctrineAssert;

/**
 * Krevindiou\BagheeraBundle\Entity\User
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="user")
 * @ORM\HasLifecycleCallbacks()
 * @DoctrineAssert\UniqueEntity(fields="email", groups={"register", "profile"})
 */
class User implements UserInterface
{
    /**
     * @var integer $userId
     *
     * @ORM\Column(name="user_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    private $userId;

    /**
     * @var string $firstname
     *
     * @ORM\Column(name="firstname", type="string", length=64, nullable=false)
     * @Assert\NotBlank(groups={"register", "profile"})
     * @Assert\MaxLength(limit=64, groups={"register", "profile"})
     */
    private $firstname;

    /**
     * @var string $lastname
     *
     * @ORM\Column(name="lastname", type="string", length=64, nullable=false)
     * @Assert\NotBlank(groups={"register", "profile"})
     * @Assert\MaxLength(limit=64, groups={"register", "profile"})
     */
    private $lastname;

    /**
     * @var string $email
     *
     * @ORM\Column(name="email", type="string", length=128, unique=true, nullable=false)
     * @Assert\NotBlank(groups={"register", "profile"})
     * @Assert\Email(groups={"register", "profile"})
     * @Assert\MaxLength(limit=128, groups={"register", "profile"})
     */
    private $email;

    /**
     * @var string $password
     *
     * @ORM\Column(name="password", type="string", length=128, nullable=false)
     * @Assert\NotBlank(groups={"register", "profile"})
     * @Assert\MinLength(limit=8, groups={"register", "profile"})
     */
    private $password;

    /**
     * @var string $activation
     *
     * @ORM\Column(name="activation", type="string", length=32, nullable=true)
     * @Assert\MinLength(limit=32, groups={"register", "profile"})
     * @Assert\MaxLength(limit=32, groups={"register", "profile"})
     */
    private $activation;

    /**
     * @var boolean $isAdmin
     *
     * @ORM\Column(name="is_admin", type="boolean", nullable=false)
     * @Assert\Type(type="bool", groups={"register", "profile"})
     */
    private $isAdmin;

    /**
     * @var boolean $isActive
     *
     * @ORM\Column(name="is_active", type="boolean", nullable=false)
     * @Assert\Type(type="bool", groups={"register", "profile"})
     */
    private $isActive;

    /**
     * @var DateTime $createdAt
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     * @Assert\DateTime(groups={"register", "profile"})
     */
    private $createdAt;

    /**
     * @var DateTime $updatedAt
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     * @Assert\DateTime(groups={"register", "profile"})
     */
    private $updatedAt;

    /**
     * @var Doctrine\Common\Collections\ArrayCollection $banks
     *
     * @ORM\OneToMany(targetEntity="Bank", mappedBy="user", cascade={"all"}, fetch="LAZY")
     * @ORM\OrderBy({"name" = "ASC"})
     */
    private $banks;


    public function __construct()
    {
        $this->isAdmin = false;
        $this->isActive = false;
    }

    /**
     * @ORM\prePersist
     */
    public function prePersist()
    {
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\preUpdate
     */
    public function preUpdate()
    {
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * Get userId
     *
     * @return integer
     */
    public function getUserId()
    {
        return $this->userId;
    }

    /**
     * Set firstname
     *
     * @param string $firstname
     */
    public function setFirstname($firstname)
    {
        $this->firstname = $firstname;
    }

    /**
     * Get firstname
     *
     * @return string
     */
    public function getFirstname()
    {
        return $this->firstname;
    }

    /**
     * Set lastname
     *
     * @param string $lastname
     */
    public function setLastname($lastname)
    {
        $this->lastname = $lastname;
    }

    /**
     * Get lastname
     *
     * @return string
     */
    public function getLastname()
    {
        return $this->lastname;
    }

    /**
     * Set email
     *
     * @param string $email
     */
    public function setEmail($email)
    {
        $this->email = $email;
    }

    /**
     * Get email
     *
     * @return string
     */
    public function getEmail()
    {
        return $this->email;
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
     * Set activation
     *
     * @param string $activation
     */
    public function setActivation($activation)
    {
        $this->activation = $activation;
    }

    /**
     * Get activation
     *
     * @return string
     */
    public function getActivation()
    {
        return $this->activation;
    }

    /**
     * Set isAdmin
     *
     * @param boolean $isAdmin
     */
    public function setIsAdmin($isAdmin)
    {
        $this->isAdmin = (bool)$isAdmin;
    }

    /**
     * Get isAdmin
     *
     * @return boolean
     */
    public function getIsAdmin()
    {
        return $this->isAdmin;
    }

    /**
     * Set isActive
     *
     * @param boolean $isActive
     */
    public function setIsActive($isActive)
    {
        $this->isActive = (bool)$isActive;
    }

    /**
     * Get isActive
     *
     * @return boolean
     */
    public function getIsActive()
    {
        return $this->isActive;
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

    /**
     * Get user banks
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getBanks()
    {
        return $this->banks;
    }

    /**
     * Get user total balance
     *
     * @return float
     */
/*
    public function getBalance()
    {
        $balance = 0;
        $banks = $this->getBanks();
        foreach ($banks as $bank) {
            $balance+= $bank->getBalance();
        }

        return sprintf('%.2f', $balance);
    }
*/
    /**
     * {@inheritdoc}
     */
    public function getRoles()
    {
        return $this->getIsAdmin() ? array('ROLE_ADMIN') : array('ROLE_USER');
    }

    /**
     * {@inheritdoc}
     */
    public function getSalt()
    {
        return null;
    }

    /**
     * {@inheritdoc}
     */
    public function getUsername()
    {
        return $this->getEmail();
    }

    /**
     * {@inheritdoc}
     */
    public function eraseCredentials()
    {
    }

    /**
     * {@inheritdoc}
     */
    public function equals(UserInterface $user)
    {
        if (!$user instanceof User) {
            return false;
        }

        if ($this->getUsername() !== $user->getUsername()) {
            return false;
        }

        return true;
    }
}
