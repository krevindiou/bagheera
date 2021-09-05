<?php

declare(strict_types=1);

namespace App\Form\Model;

use App\Entity\Member;
use App\Validator\Constraints\FieldExists;
use Symfony\Component\Validator\Constraints as Assert;

class MemberForgotPasswordFormModel
{
    /**
     * @FieldExists(className = Member::class, field = "email")
     */
    #[Assert\NotBlank]
    #[Assert\Email]
    public $email;
}
