<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class SchedulerFormModel
{
    public $schedulerId;

    /**
     * @Assert\NotBlank()
     * @Assert\Type(type="App\Entity\Account")
     */
    public $account;

    /**
     * @Assert\NotBlank()
     * @Assert\Choice({"debit", "credit"})
     */
    public $type;

    /**
     * @Assert\NotBlank()
     * @Assert\Length(max = 64)
     */
    public $thirdParty;

    /**
     * @Assert\Type(type="App\Entity\Category")
     */
    public $category;

    /**
     * @Assert\NotBlank()
     * @Assert\Type(type="App\Entity\PaymentMethod")
     */
    public $paymentMethod;

    /**
     * @Assert\NotBlank()
     * @Assert\Type("DateTime")
     */
    public $valueDate;

    public $notes;

    /**
     * @Assert\Type("bool")
     */
    public $reconciled;

    /**
     * @Assert\Type("bool")
     */
    public $active;

    /**
     * @Assert\NotBlank()
     * @Assert\Type("int")
     */
    public $amount;

    /**
     * @Assert\Type("DateTime")
     */
    public $limitDate;

    /**
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"day", "week", "month", "year"})
     */
    public $frequencyUnit;

    /**
     * @Assert\NotBlank()
     * @Assert\Type("integer")
     */
    public $frequencyValue;

    /**
     * @Assert\Type(type="App\Entity\Account")
     */
    public $transferAccount;

    public function __construct()
    {
        $this->type = 'debit';
        $this->reconciled = false;
        $this->frequencyUnit = 'month';
        $this->active = true;
    }
}
