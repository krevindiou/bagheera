<?php

declare(strict_types=1);

namespace App\Form\Model;

use App\Entity\Account;
use App\Entity\Category;
use App\Entity\PaymentMethod;
use Symfony\Component\Validator\Constraints as Assert;

class OperationFormModel
{
    public $operationId;

    #[Assert\NotBlank]
    #[Assert\Type(type: Account::class)]
    public $account;

    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['debit', 'credit'])]
    public string $type;

    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    public $thirdParty;

    #[Assert\Type(type: Category::class)]
    public $category;

    #[Assert\NotBlank]
    #[Assert\Type(type: PaymentMethod::class)]
    public $paymentMethod;

    #[Assert\NotBlank]
    #[Assert\Type(type: \DateTime::class)]
    public \DateTime $valueDate;

    public $notes;

    #[Assert\Type(type: 'bool')]
    public bool $reconciled;

    #[Assert\NotBlank]
    #[Assert\Type(type: 'int')]
    public $amount;

    #[Assert\Type(type: Account::class)]
    public $transferAccount;

    public function __construct()
    {
        $this->type = 'debit';
        $this->valueDate = new \DateTime();
        $this->reconciled = false;
    }
}
