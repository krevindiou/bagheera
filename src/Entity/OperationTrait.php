<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\ManyToOne;
use Symfony\Component\Validator\Constraints as Assert;

trait OperationTrait
{
    use TimestampableTrait;

    #[Assert\Type(type: Account::class)]
    #[ManyToOne(targetEntity: Account::class, fetch: 'EAGER')]
    #[JoinColumn(name: 'transfer_account_id', referencedColumnName: 'account_id')]
    protected ?Account $transferAccount;

    #[Assert\Type(type: Category::class)]
    #[ManyToOne(targetEntity: Category::class, fetch: 'EAGER')]
    #[JoinColumn(name: 'category_id', referencedColumnName: 'category_id')]
    protected ?Category $category;

    #[Assert\NotNull]
    #[Assert\Type(type: PaymentMethod::class)]
    #[ManyToOne(targetEntity: PaymentMethod::class)]
    #[JoinColumn(name: 'payment_method_id', referencedColumnName: 'payment_method_id', nullable: false)]
    protected PaymentMethod $paymentMethod;

    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    #[Column(name: 'third_party', type: 'string', length: 64)]
    protected string $thirdParty;

    #[Column(name: 'debit', type: 'integer', nullable: true)]
    protected null|int $debit;

    #[Column(name: 'credit', type: 'integer', nullable: true)]
    protected null|int $credit;

    #[Assert\NotBlank]
    #[Assert\Type(type: \DateTime::class)]
    #[Column(name: 'value_date', type: 'date')]
    protected \DateTime $valueDate;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_reconciled', type: 'boolean', options: ['default' => false])]
    protected bool $reconciled = false;

    #[Column(name: 'notes', type: 'text')]
    protected string $notes;

    public function setAccount(Account $account): void
    {
        $this->account = $account;
    }

    public function getAccount(): ?Account
    {
        return $this->account ?? null;
    }

    public function setTransferAccount(?Account $transferAccount): void
    {
        $this->transferAccount = $transferAccount;
    }

    public function getTransferAccount(): ?Account
    {
        return $this->transferAccount;
    }

    public function setCategory(?Category $category): void
    {
        $this->category = $category;
    }

    public function getCategory(): ?Category
    {
        return $this->category;
    }

    public function setPaymentMethod(?PaymentMethod $paymentMethod): void
    {
        $this->paymentMethod = $paymentMethod;
    }

    public function getPaymentMethod(): ?PaymentMethod
    {
        return $this->paymentMethod;
    }

    public function setThirdParty(string $thirdParty): void
    {
        $this->thirdParty = $thirdParty;
    }

    public function getThirdParty(): ?string
    {
        return $this->thirdParty;
    }

    public function setDebit(?int $debit): void
    {
        if (null !== $debit) {
            $this->credit = null;
        }

        $this->debit = $debit;
    }

    public function getDebit(): ?int
    {
        return $this->debit;
    }

    public function setCredit(?int $credit): void
    {
        if (null !== $credit) {
            $this->debit = null;
        }

        $this->credit = $credit;
    }

    public function getCredit(): ?int
    {
        return $this->credit;
    }

    public function setValueDate(?\DateTime $valueDate): void
    {
        $this->valueDate = $valueDate;
    }

    public function getValueDate(): ?\DateTime
    {
        return $this->valueDate;
    }

    public function setReconciled(bool $reconciled): void
    {
        $this->reconciled = $reconciled;
    }

    public function isReconciled(): ?bool
    {
        return $this->reconciled;
    }

    public function setNotes(string $notes): void
    {
        $this->notes = $notes;
    }

    public function getNotes(): string
    {
        return $this->notes ?? '';
    }
}
