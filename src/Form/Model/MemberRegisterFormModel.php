<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class MemberRegisterFormModel
{
    #[Assert\NotBlank]
    #[Assert\Email]
    #[Assert\Length(max: 128)]
    public $email;

    #[Assert\NotBlank]
    public $country;

    #[Assert\NotBlank]
    #[Assert\Length(min: 8, max: 4096)]
    public $plainPassword;
}
