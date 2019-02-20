<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\PaymentMethodRepository")
 * @ORM\Table(name="payment_method")
 */
class PaymentMethod
{
    public const PAYMENT_METHOD_ID_INITIAL_BALANCE = 9;
    public const PAYMENT_METHOD_ID_DEBIT_CREDIT_CARD = 1;
    public const PAYMENT_METHOD_ID_DEBIT_CHECK = 2;
    public const PAYMENT_METHOD_ID_DEBIT_CASH_WITHDRAWAL = 3;
    public const PAYMENT_METHOD_ID_DEBIT_DIRECT_DEBIT = 8;
    public const PAYMENT_METHOD_ID_DEBIT_TRANSFER = 4;
    public const PAYMENT_METHOD_ID_CREDIT_CHECK = 5;
    public const PAYMENT_METHOD_ID_CREDIT_TRANSFER = 6;
    public const PAYMENT_METHOD_ID_CREDIT_DEPOSIT = 7;

    /**
     * @var int
     *
     * @ORM\Column(name="payment_method_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $paymentMethodId;

    /**
     * @var string
     *
     * @ORM\Column(name="name", type="string", length=16)
     * @Assert\NotBlank()
     */
    protected $name;

    /**
     * @var string
     *
     * @ORM\Column(name="type", type="string", length=8, nullable=true)
     * @Assert\Choice(choices = {"debit", "credit"})
     */
    protected $type;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="created_at", type="datetime")
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=true)
     */
    protected $updatedAt;

    public function __toString(): string
    {
        return $this->getName();
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

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }
}
