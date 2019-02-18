<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity
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
     * @ORM\Column(name="payment_method_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $paymentMethodId;

    /**
     * @var string
     *
     * @ORM\Column(name="name", type="string", length=16, nullable=false)
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
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     */
    protected $updatedAt;

    public function __toString(): string
    {
        return $this->getName();
    }

    /**
     * Get paymentMethodId.
     *
     * @return int
     */
    public function getPaymentMethodId(): ?int
    {
        return $this->paymentMethodId;
    }

    /**
     * Set name.
     *
     * @param string $name
     */
    public function setName(string $name): void
    {
        $this->name = $name;
    }

    /**
     * Get name.
     *
     * @return string
     */
    public function getName(): ?string
    {
        return $this->name;
    }

    /**
     * Set type.
     *
     * @param string $type
     */
    public function setType(string $type): void
    {
        $this->type = $type;
    }

    /**
     * Get type.
     *
     * @return string
     */
    public function getType(): ?string
    {
        return $this->type;
    }

    /**
     * Get createdAt.
     *
     * @return DateTime
     */
    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    /**
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }
}
