<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class BankAccessFormModel
{
    /**
     * @Assert\Type(type="App\Entity\Bank")
     */
    public $bank;

    /**
     * @Assert\NotBlank()
     */
    public $plainLogin;

    /**
     * @Assert\NotBlank()
     */
    public $plainPassword;
}
