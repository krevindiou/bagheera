<?php

declare(strict_types=1);

namespace App\Form\Model;

use App\Entity\Bank;
use App\Entity\Provider;
use Symfony\Component\Validator\Constraints as Assert;

class BankChooseFormModel
{
    #[Assert\Type(type: Provider::class)]
    public $provider;

    #[Assert\Type(type: Bank::class)]
    public $bank;

    #[Assert\Length(max: 32)]
    public $other;
}
