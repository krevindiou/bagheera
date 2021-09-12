<?php

declare(strict_types=1);

namespace App\Form\Model;

use App\Entity\Bank;
use Symfony\Component\Validator\Constraints as Assert;

class BankAccessFormModel
{
    #[Assert\Type(type: Bank::class)]
    public $bank;

    #[Assert\NotBlank]
    public $plainLogin;

    #[Assert\NotBlank]
    public $plainPassword;
}
