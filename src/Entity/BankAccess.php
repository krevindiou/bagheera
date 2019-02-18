<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity
 * @ORM\Table(name="bank_access")
 */
class BankAccess
{
    /**
     * @var int
     *
     * @ORM\Column(name="bank_id", type="integer")
     * @ORM\Id
     */
    protected $bankId;

    /**
     * @var string
     *
     * @Assert\NotBlank()
     * @Assert\Length(max = 255)
     */
    protected $plainLogin;

    /**
     * @var string
     *
     * @Assert\NotBlank()
     * @Assert\Length(max = 255)
     */
    protected $plainPassword;

    /**
     * @var string
     *
     * @ORM\Column(name="login", type="string", length=255)
     */
    protected $login;

    /**
     * @var string
     *
     * @ORM\Column(name="password", type="string", length=255)
     */
    protected $password;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     */
    protected $updatedAt;

    /**
     * Set bankId.
     *
     * @param int $bankId
     */
    public function setBankId(int $bankId): void
    {
        $this->bankId = $bankId;
    }

    /**
     * Get bankId.
     *
     * @return int
     */
    public function getBankId(): int
    {
        return $this->bankId;
    }

    /**
     * Set plainLogin.
     *
     * @param string $plainLogin
     */
    public function setPlainLogin(string $plainLogin): void
    {
        $this->plainLogin = $plainLogin;
    }

    /**
     * Get plainLogin.
     *
     * @return string
     */
    public function getPlainLogin(): string
    {
        return $this->plainLogin;
    }

    /**
     * Set plainPassword.
     *
     * @param string $plainPassword
     */
    public function setPlainPassword(string $plainPassword): void
    {
        $this->plainPassword = $plainPassword;
    }

    /**
     * Get plainPassword.
     *
     * @return string
     */
    public function getPlainPassword(): string
    {
        return $this->plainPassword;
    }

    /**
     * Set login.
     *
     * @param string $login
     */
    public function setLogin(string $login): void
    {
        $this->login = $login;
    }

    /**
     * Get login.
     *
     * @return string
     */
    public function getLogin(): string
    {
        return $this->login;
    }

    /**
     * Set password.
     *
     * @param string $password
     */
    public function setPassword(string $password): void
    {
        $this->password = $password;
    }

    /**
     * Get password.
     *
     * @return string
     */
    public function getPassword(): string
    {
        return $this->password;
    }

    /**
     * Get createdAt.
     *
     * @return DateTime
     */
    public function getCreatedAt(): \DateTime
    {
        return $this->createdAt;
    }

    /**
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt(): \DateTime
    {
        return $this->updatedAt;
    }
}
