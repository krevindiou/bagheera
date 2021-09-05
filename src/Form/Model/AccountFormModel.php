<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class AccountFormModel
{
    public $accountId;

    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    public $name;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'App\Entity\Bank')]
    public $bank;

    #[Assert\NotBlank]
    #[Assert\Currency]
    public $currency;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'int')]
    public int $overdraftFacility;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'int')]
    public int $initialBalance;

    public function __construct()
    {
        $this->overdraftFacility = 0;
        $this->initialBalance = 0;
    }
}
