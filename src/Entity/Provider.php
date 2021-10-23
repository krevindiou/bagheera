<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'provider')]
class Provider
{
    use TimestampableTrait;

    #[Id, Column(name: 'provider_id', type: Types::SMALLINT)]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $providerId = null;

    #[Assert\NotBlank]
    #[Column(name: 'name', type: Types::STRING, length: 64)]
    private ?string $name = null;

    #[Assert\NotBlank]
    #[Column(name: 'country', type: Types::STRING, length: 2)]
    private ?string $country = null;

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
