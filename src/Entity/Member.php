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
 * @ORM\Entity
 * @ORM\Table(name="member")
 * @DoctrineAssert\UniqueEntity("email")
 */
class Member implements UserInterface
{
    /**
     * @var int
     *
     * @ORM\Column(name="member_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $memberId;

    /**
     * @var string
     *
     * @ORM\Column(name="email", type="string", length=128, unique=true, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Email()
     * @Assert\Length(max = 128)
     */
    protected $email;

    /**
     * @var string
     *
     * @ORM\Column(name="password", type="string", length=128, nullable=false)
     */
    protected $password;

    /**
     * @var string
     *
     * @Assert\NotBlank(groups={"password"})
     * @Assert\Length(min = 8, max = 4096)
     */
    protected $plainPassword;

    /**
     * @var string
     *
     * @ORM\Column(name="country", type="string", length=2, nullable=false)
     * @Assert\NotBlank()
     */
    protected $country;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_active", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $active = false;

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
     * @var DateTime
     *
     * @ORM\Column(name="logged_at", type="datetime", nullable=true)
     * @Assert\Type("DateTime")
     */
    protected $loggedAt;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\OneToMany(targetEntity="Bank", mappedBy="member", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"sortOrder" = "ASC"})
     */
    protected $banks;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\OneToMany(targetEntity="Report", mappedBy="member", cascade={"all"}, fetch="EXTRA_LAZY")
     * @ORM\OrderBy({"type" = "ASC", "title" = "ASC"})
     */
    protected $reports;

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

    public function setPlainPassword(?string $plainPassword): void
    {
        $this->plainPassword = $plainPassword;
    }

    public function getPlainPassword(): ?string
    {
        return $this->plainPassword;
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

    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
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

    public function getSalt(): void
    {
    }

    public function getUsername(): ?string
    {
        return $this->getEmail();
    }

    public function eraseCredentials(): void
    {
        $this->setPlainPassword(null);
    }
}
