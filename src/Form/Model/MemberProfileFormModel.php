<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class MemberProfileFormModel
{
    /**
     * @Assert\NotBlank()
     * @Assert\Email()
     * @Assert\Length(max = 128)
     */
    public $email;
}
