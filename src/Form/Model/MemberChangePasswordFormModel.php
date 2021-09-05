<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class MemberChangePasswordFormModel
{
    #[Assert\NotBlank]
    #[Assert\Length(min: 8, max: 4096)]
    public $password;
}
