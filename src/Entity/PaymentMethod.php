<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'payment_method')]
class PaymentMethod
{
    use TimestampableTrait;

    public const PAYMENT_METHOD_ID_INITIAL_BALANCE = 9;
    public const PAYMENT_METHOD_ID_DEBIT_CREDIT_CARD = 1;
    public const PAYMENT_METHOD_ID_DEBIT_CHECK = 2;
    public const PAYMENT_METHOD_ID_DEBIT_CASH_WITHDRAWAL = 3;
    public const PAYMENT_METHOD_ID_DEBIT_DIRECT_DEBIT = 8;
    public const PAYMENT_METHOD_ID_DEBIT_TRANSFER = 4;
    public const PAYMENT_METHOD_ID_CREDIT_CHECK = 5;
    public const PAYMENT_METHOD_ID_CREDIT_TRANSFER = 6;
    public const PAYMENT_METHOD_ID_CREDIT_DEPOSIT = 7;

    #[Id, Column(name: 'payment_method_id', type: Types::INTEGER)]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $paymentMethodId = null;

    #[Assert\NotBlank]
    #[Column(name: 'name', type: Types::STRING, length: 16)]
    private ?string $name = null;

    #[Assert\Choice(choices: ['debit', 'credit'])]
    #[Column(name: 'type', type: Types::STRING, length: 8, nullable: true)]
    private ?string $type = null;

    public function __toString(): string
    {
        return $this->getName();
    }

    public function setPaymentMethodId(int $paymentMethodId): void
    {
        $this->paymentMethodId = $paymentMethodId;
    }

    public function getPaymentMethodId(): ?int
    {
        return $this->paymentMethodId;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setType(?string $type): void
    {
        $this->type = $type;
    }

    public function getType(): ?string
    {
        return $this->type;
    }
}
