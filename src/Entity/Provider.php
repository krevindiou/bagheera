<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\ProviderRepository")
 * @ORM\Table(name="provider")
 */
class Provider
{
    use TimestampableTrait;

    /**
     *
     * @ORM\Column(name="provider_id", type="smallint")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected ?int $providerId = null;

    /**
     * @ORM\Column(name="name", type="string", length=64)
     */
    #[Assert\NotBlank]
    protected ?string $name = null;

    /**
     * @ORM\Column(name="country", type="string", length=2)
     */
    #[Assert\NotBlank]
    protected ?string $country = null;

    public function __toString(): string
    {
        return $this->getName();
    }

    public function getProviderId(): ?int
    {
        return $this->providerId;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setCountry(string $country): void
    {
        $this->country = $country;
    }

    public function getCountry(): ?string
    {
        return $this->country;
    }
}
