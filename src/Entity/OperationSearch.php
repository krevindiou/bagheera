<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\InverseJoinColumn;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\JoinTable;
use Doctrine\ORM\Mapping\ManyToMany;
use Doctrine\ORM\Mapping\ManyToOne;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'operation_search')]
class OperationSearch
{
    use TimestampableTrait;

    #[Id, Column(name: 'operation_search_id', type: Types::INTEGER)]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $operationSearchId = null;

    #[Assert\NotNull]
    #[Assert\Type(type: Account::class)]
    #[ManyToOne(targetEntity: Account::class, cascade: ['all'], fetch: 'EAGER')]
    #[JoinColumn(name: 'account_id', referencedColumnName: 'account_id', nullable: false)]
    private ?Account $account = null;

    #[ManyToMany(targetEntity: Category::class, cascade: ['all'], fetch: 'EAGER')]
    #[JoinTable(name: 'operation_search_category')]
    #[JoinColumn(name: 'operation_search_id', referencedColumnName: 'operation_search_id')]
    #[InverseJoinColumn(name: 'category_id', referencedColumnName: 'category_id')]
    private Collection $categories;

    #[ManyToMany(targetEntity: PaymentMethod::class, cascade: ['all'], fetch: 'EAGER')]
    #[JoinTable(name: 'operation_search_payment_method')]
    #[JoinColumn(name: 'operation_search_id', referencedColumnName: 'operation_search_id')]
    #[InverseJoinColumn(name: 'payment_method_id', referencedColumnName: 'payment_method_id')]
    private Collection $paymentMethods;

    #[Assert\Length(max: 64)]
    #[Column(name: 'third_party', type: Types::STRING, length: 64, nullable: true)]
    private ?string $thirdParty = null;

    #[Assert\Length(max: 128)]
    #[Column(name: 'notes', type: Types::STRING, length: 128, nullable: true)]
    private ?string $notes = null;

    #[Assert\Type(type: \DateTime::class)]
    #[Column(name: 'value_date_start', type: Types::DATE_MUTABLE, nullable: true)]
    private ?\DateTime $valueDateStart = null;

    #[Assert\Type(type: \DateTime::class)]
    #[Column(name: 'value_date_end', type: Types::DATE_MUTABLE, nullable: true)]
    private ?\DateTime $valueDateEnd = null;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_reconciled', type: Types::BOOLEAN, nullable: true)]
    private ?bool $reconciled = null;

    #[Assert\Choice(choices: ['debit', 'credit'])]
    #[Column(name: 'type', type: Types::STRING, length: 8, nullable: true, options: ['default' => 'debit'])]
    private ?string $type = 'debit';

    #[Column(name: 'amount_inferior_to', type: Types::INTEGER, nullable: true)]
    private ?int $amountInferiorTo = null;

    #[Column(name: 'amount_inferior_or_equal_to', type: Types::INTEGER, nullable: true)]
    private ?int $amountInferiorOrEqualTo = null;

    #[Column(name: 'amount_equal_to', type: Types::INTEGER, nullable: true)]
    private ?int $amountEqualTo = null;

    #[Column(name: 'amount_superior_or_equal_to', type: Types::INTEGER, nullable: true)]
    private ?int $amountSuperiorOrEqualTo = null;

    #[Column(name: 'amount_superior_to', type: Types::INTEGER, nullable: true)]
    private ?int $amountSuperiorTo = null;

    public function __construct()
    {
        $this->categories = new ArrayCollection();
        $this->paymentMethods = new ArrayCollection();
    }

    public function getOperationSearchId(): ?int
    {
        return $this->operationSearchId;
    }

    public function setAccount(Account $account): void
    {
        $this->account = $account;
    }

    public function getAccount(): ?Account
    {
        return $this->account;
    }

    public function setCategories(Collection $categories): void
    {
        $this->categories = $categories;
    }

    public function getCategories(): Collection
    {
        return $this->categories;
    }

    public function setPaymentMethods(Collection $paymentMethods): void
    {
        $this->paymentMethods = $paymentMethods;
    }

    public function getPaymentMethods(): Collection
    {
        return $this->paymentMethods;
    }

    public function setThirdParty(?string $thirdParty): void
    {
        $this->thirdParty = $thirdParty;
    }

    public function getThirdParty(): ?string
    {
        return $this->thirdParty;
    }

    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setValueDateStart(?\DateTime $valueDateStart): void
    {
        $this->valueDateStart = $valueDateStart;
    }

    public function getValueDateStart(): ?\DateTime
    {
        return $this->valueDateStart;
    }

    public function setValueDateEnd(?\DateTime $valueDateEnd): void
    {
        $this->valueDateEnd = $valueDateEnd;
    }

    public function getValueDateEnd(): ?\DateTime
    {
        return $this->valueDateEnd;
    }

    public function setReconciled(?bool $reconciled): void
    {
        $this->reconciled = $reconciled;
    }

    public function isReconciled(): ?bool
    {
        return $this->reconciled;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setAmountInferiorTo(?int $amountInferiorTo): void
    {
        $this->amountInferiorTo = $amountInferiorTo;
    }

    public function getAmountInferiorTo(): ?int
    {
        return $this->amountInferiorTo;
    }

    public function setAmountInferiorOrEqualTo(?int $amountInferiorOrEqualTo): void
    {
        $this->amountInferiorOrEqualTo = $amountInferiorOrEqualTo;
    }

    public function getAmountInferiorOrEqualTo(): ?int
    {
        return $this->amountInferiorOrEqualTo;
    }

    public function setAmountEqualTo(?int $amountEqualTo): void
    {
        $this->amountEqualTo = $amountEqualTo;
    }

    public function getAmountEqualTo(): ?int
    {
        return $this->amountEqualTo;
    }

    public function setAmountSuperiorOrEqualTo(?int $amountSuperiorOrEqualTo): void
    {
        $this->amountSuperiorOrEqualTo = $amountSuperiorOrEqualTo;
    }

    public function getAmountSuperiorOrEqualTo(): ?int
    {
        return $this->amountSuperiorOrEqualTo;
    }

    public function setAmountSuperiorTo(?int $amountSuperiorTo): void
    {
        $this->amountSuperiorTo = $amountSuperiorTo;
    }

    public function getAmountSuperiorTo(): ?int
    {
        return $this->amountSuperiorTo;
    }
}
