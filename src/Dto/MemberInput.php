<?php

declare(strict_types=1);

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class MemberInput
{
    #[Assert\NotBlank]
    #[Assert\Email]
    #[Assert\Length(max: 128)]
    public string $email;

    #[Assert\NotBlank]
    #[Assert\Length(min: 2, max: 2)]
    public string $country;

    #[Assert\NotBlank]
    #[Assert\Length(min: 8, max: 4096)]
    public string $plainPassword;
}
