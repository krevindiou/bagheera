<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class SchedulerFormModel
{
    public $schedulerId;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'App\Entity\Account')]
    public $account;

    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['debit', 'credit'])]
    public string $type;

    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    public $thirdParty;

    #[Assert\Type(type: 'App\Entity\Category')]
    public $category;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'App\Entity\PaymentMethod')]
    public $paymentMethod;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'DateTime')]
    public $valueDate;

    public $notes;

    #[Assert\Type(type: 'bool')]
    public bool $reconciled;

    #[Assert\Type(type: 'bool')]
    public bool $active;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'int')]
    public $amount;

    #[Assert\Type(type: 'DateTime')]
    public $limitDate;

    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['day', 'week', 'month', 'year'])]
    public string $frequencyUnit;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'integer')]
    public $frequencyValue;

    #[Assert\Type(type: 'App\Entity\Account')]
    public $transferAccount;

    public function __construct()
    {
        $this->type = 'debit';
        $this->reconciled = false;
        $this->frequencyUnit = 'month';
        $this->active = true;
    }
}
