<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints as DoctrineAssert;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\MemberRepository")
 * @ORM\Table(name="member", uniqueConstraints={@ORM\UniqueConstraint(name="member_email_unique", columns={"email"})})
 * @DoctrineAssert\UniqueEntity("email")
 */
class Member implements UserInterface
{
    use TimestampableTrait;

    /**
     *
     * @ORM\Column(name="member_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected ?int $memberId = null;

    /**
     * @ORM\Column(name="email", type="string", length=128, unique=true)
     */
    #[Assert\NotBlank]
    #[Assert\Email]
    #[Assert\Length(max: 128)]
    protected ?string $email = null;

    /**
     * @ORM\Column(name="password", type="string", length=60)
     */
    protected ?string $password = null;

    /**
     * @ORM\Column(name="country", type="string", length=2)
     */
    #[Assert\NotBlank]
    protected ?string $country = null;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_active", type="boolean", options={"default": false})
     */
    #[Assert\Type(type: 'bool')]
    protected $active = false;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="logged_at", type="datetime", nullable=true)
     */
    #[Assert\Type(type: 'DateTime')]
    protected $loggedAt;

    /**
     * @var Collection
     *
     * @ORM\OneToMany(targetEntity="Bank", mappedBy="member", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"sortOrder" = "ASC"})
     */
    protected array|Collection|ArrayCollection $banks;

    /**
     * @var Collection
     *
     * @ORM\OneToMany(targetEntity="Report", mappedBy="member", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"type" = "ASC", "title" = "ASC"})
     */
    protected array|Collection|ArrayCollection $reports;

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
