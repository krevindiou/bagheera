<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class OperationSearchFormModel
{
    #[Assert\Choice(choices: ['debit', 'credit'])]
    public string $type;

    #[Assert\Length(max: 64)]
    public $thirdParty;

    public $categories;

    public $paymentMethods;

    #[Assert\Type(type: 'DateTime')]
    public $valueDateStart;

    #[Assert\Type(type: 'DateTime')]
    public $valueDateEnd;

    #[Assert\Length(max: 128)]
    public $notes;

    #[Assert\Type(type: 'bool')]
    public $reconciled;

    #[Assert\Choice(choices: ['<', '<=', '=', '>=', '>'])]
    public $amountComparator1;

    #[Assert\Type(type: 'int')]
    public $amount1;

    #[Assert\Choice(choices: ['<', '<=', '=', '>=', '>'])]
    public $amountComparator2;

    #[Assert\Type(type: 'int')]
    public $amount2;

    public function __construct()
    {
        $this->type = 'debit';
    }
}
