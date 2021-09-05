<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class BankUpdateFormModel
{
    #[Assert\NotBlank]
    #[Assert\Length(max: 32)]
    public $name;
}
