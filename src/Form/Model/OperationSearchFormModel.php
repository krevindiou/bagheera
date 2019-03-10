<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class OperationSearchFormModel
{
    /**
     * @Assert\Choice(choices = {"debit", "credit"})
     */
    public $type;

    /**
     * @Assert\Length(max = 64)
     */
    public $thirdParty;

    public $categories;

    public $paymentMethods;

    /**
     * @Assert\Type("DateTime")
     */
    public $valueDateStart;

    /**
     * @Assert\Type("DateTime")
     */
    public $valueDateEnd;

    /**
     * @Assert\Length(max = 128)
     */
    public $notes;

    /**
     * @Assert\Type("bool")
     */
    public $reconciled;

    /**
     * @Assert\Choice(choices = {"<", "<=", "=", ">=", ">"})
     */
    public $amountComparator1;

    /**
     * @Assert\Type("int")
     */
    public $amount1;

    /**
     * @Assert\Choice(choices = {"<", "<=", "=", ">=", ">"})
     */
    public $amountComparator2;

    /**
     * @Assert\Type("int")
     */
    public $amount2;

    public function __construct()
    {
        $this->type = 'debit';
    }
}
