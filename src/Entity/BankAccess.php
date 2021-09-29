<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'bank_access')]
class BankAccess
{
    use TimestampableTrait;

    #[Id, Column(name: 'bank_id', type: 'integer')]
    private ?int $bankId = null;

    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    private ?string $plainLogin = null;

    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    private ?string $plainPassword = null;

    #[Column(name: 'login', type: 'string', length: 255)]
    private ?string $login = null;

    #[Column(name: 'password', type: 'string', length: 255)]
    private ?string $password = null;

    public function setBankId(int $bankId): void
    {
        $this->bankId = $bankId;
    }

    public function getBankId(): int
    {
        return $this->bankId;
    }

    public function setPlainLogin(string $plainLogin): void
    {
        $this->plainLogin = $plainLogin;
    }

    public function getPlainLogin(): string
    {
        return $this->plainLogin;
    }

    public function setPlainPassword(string $plainPassword): void
    {
        $this->plainPassword = $plainPassword;
    }

    public function getPlainPassword(): string
    {
        return $this->plainPassword;
    }

    public function setLogin(string $login): void
    {
        $this->login = $login;
    }

    public function getLogin(): string
    {
        return $this->login;
    }

    public function setPassword(string $password): void
    {
        $this->password = $password;
    }

    public function getPassword(): string
    {
        return $this->password;
    }
}
