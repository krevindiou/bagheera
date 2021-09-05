<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class BankChooseFormModel
{
    #[Assert\Type(type: 'App\Entity\Provider')]
    public $provider;

    #[Assert\Type(type: 'App\Entity\Bank')]
    public $bank;

    #[Assert\Length(max: 32)]
    public $other;
}
