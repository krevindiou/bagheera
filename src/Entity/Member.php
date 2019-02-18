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

    /**
     * Get memberId.
     *
     * @return int
     */
    public function getMemberId(): ?int
    {
        return $this->memberId;
    }

    /**
     * Set email.
     *
     * @param string $email
     */
    public function setEmail(string $email): void
    {
        $this->email = $email;
    }

    /**
     * Get email.
     *
     * @return string
     */
    public function getEmail(): ?string
    {
        return $this->email;
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
    public function getPassword(): ?string
    {
        return $this->password;
    }

    /**
     * Set plainPassword.
     *
     * @param string $plainPassword
     */
    public function setPlainPassword(?string $plainPassword): void
    {
        $this->plainPassword = $plainPassword;
    }

    /**
     * Get plainPassword.
     *
     * @return string
     */
    public function getPlainPassword(): ?string
    {
        return $this->plainPassword;
    }

    /**
     * Set country.
     *
     * @param string $country
     */
    public function setCountry(string $country): void
    {
        $this->country = $country;
    }

    /**
     * Get country.
     *
     * @return string
     */
    public function getCountry(): ?string
    {
        return $this->country;
    }

    /**
     * Set active.
     *
     * @param bool $active
     */
    public function setActive(bool $active): void
    {
        $this->active = (bool) $active;
    }

    /**
     * Get active.
     *
     * @return bool
     */
    public function isActive(): ?bool
    {
        return $this->active;
    }

    /**
     * Get createdAt.
     *
     * @return DateTime
     */
    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    /**
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }

    /**
     * Set loggedAt.
     *
     * @param DateTime $loggedAt
     */
    public function setLoggedAt(\DateTime $loggedAt): void
    {
        $this->loggedAt = $loggedAt;
    }

    /**
     * Get loggedAt.
     *
     * @return DateTime
     */
    public function getLoggedAt(): ?\DateTime
    {
        return $this->loggedAt;
    }

    /**
     * Get member banks.
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getBanks(): Collection
    {
        return $this->banks;
    }

    /**
     * Get member reports.
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getReports(): Collection
    {
        return $this->reports;
    }

    /**
     * {@inheritdoc}
     */
    public function getRoles(): array
    {
        return ['ROLE_USER'];
    }

    /**
     * {@inheritdoc}
     */
    public function getSalt(): void
    {
    }

    /**
     * {@inheritdoc}
     */
    public function getUsername(): ?string
    {
        return $this->getEmail();
    }

    /**
     * {@inheritdoc}
     */
    public function eraseCredentials(): void
    {
        $this->setPlainPassword(null);
    }
}
