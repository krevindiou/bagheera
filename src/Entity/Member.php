<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\OneToMany;
use Doctrine\ORM\Mapping\OrderBy;
use Doctrine\ORM\Mapping\Table;
use Doctrine\ORM\Mapping\UniqueConstraint;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'member')]
#[UniqueEntity('email')]
#[UniqueConstraint(name: 'member_email_unique', columns: ['email'])]
class Member implements UserInterface
{
    use TimestampableTrait;

    #[Id, Column(name: 'member_id', type: 'integer')]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $memberId = null;

    #[Assert\NotBlank]
    #[Assert\Email]
    #[Assert\Length(max: 128)]
    #[Column(name: 'email', type: 'string', length: 128, unique: true)]
    private ?string $email = null;

    #[Column(name: 'password', type: 'string', length: 60)]
    private ?string $password = null;

    #[Assert\NotBlank]
    #[Column(name: 'country', type: 'string', length: 2)]
    private ?string $country = null;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_active', type: 'boolean', options: ['default' => false])]
    private ?bool $active = false;

    #[Assert\Type(type: \DateTime::class)]
    #[Column(name: 'logged_at', type: 'datetime', nullable: true)]
    private ?\DateTime $loggedAt = null;

    #[OneToMany(targetEntity: Bank::class, mappedBy: 'member', cascade: ['all'], fetch: 'EXTRA_LAZY')]
    #[OrderBy(value: ['sortOrder' => 'ASC'])]
    private Collection $banks;

    #[OneToMany(targetEntity: Report::class, mappedBy: 'member', cascade: ['all'], fetch: 'EXTRA_LAZY')]
    #[OrderBy(value: ['type' => 'ASC', 'title' => 'ASC'])]
    private Collection $reports;

    public function __construct()
    {
        $this->banks = new ArrayCollection();
        $this->reports = new ArrayCollection();
    }

    public function getMemberId(): ?int
    {
        return $this->memberId;
    }

    public function setEmail(string $email): void
    {
        $this->email = $email;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setPassword(string $password): void
    {
        $this->password = $password;
    }

    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setCountry(string $country): void
    {
        $this->country = $country;
    }

    public function getCountry(): ?string
    {
        return $this->country;
    }

    public function setActive(bool $active): void
    {
        $this->active = (bool) $active;
    }

    public function isActive(): ?bool
    {
        return $this->active;
    }

    public function setLoggedAt(\DateTime $loggedAt): void
    {
        $this->loggedAt = $loggedAt;
    }

    public function getLoggedAt(): ?\DateTime
    {
        return $this->loggedAt;
    }

    public function getBanks(): Collection
    {
        return $this->banks;
    }

    public function getReports(): Collection
    {
        return $this->reports;
    }

    public function getRoles(): array
    {
        return ['ROLE_USER'];
    }

    public function getSalt(): ?string
    {
        return null;
    }

    public function getUsername(): ?string
    {
        return $this->getEmail();
    }

    public function eraseCredentials(): void
    {
    }
}
