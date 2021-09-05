<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity
 * @ORM\Table(name="operation_search")
 */
class OperationSearch
{
    use TimestampableTrait;

    /**
     *
     * @ORM\Column(name="operation_search_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected ?int $operationSearchId = null;

    /**
     *
     * @ORM\ManyToOne(targetEntity="Account", cascade={"all"}, fetch="EAGER")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     */
    #[Assert\NotNull]
    #[Assert\Type(type: 'App\Entity\Account')]
    #[Assert\Valid]
    protected ?Account $account = null;

    /**
     * @ORM\ManyToMany(targetEntity="Category", cascade={"all"}, fetch="EAGER")
     * @ORM\JoinTable(name="operation_search_category",
     *   joinColumns={
     *     @ORM\JoinColumn(name="operation_search_id", referencedColumnName="operation_search_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="category_id", referencedColumnName="category_id")
     *   }
     * )
     */
    protected array|Collection|ArrayCollection $categories;

    /**
     * @ORM\ManyToMany(targetEntity="PaymentMethod", cascade={"all"}, fetch="EAGER")
     * @ORM\JoinTable(name="operation_search_payment_method",
     *   joinColumns={
     *     @ORM\JoinColumn(name="operation_search_id", referencedColumnName="operation_search_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="payment_method_id", referencedColumnName="payment_method_id")
     *   }
     * )
     */
    protected array|Collection|ArrayCollection $paymentMethods;

    /**
     * @ORM\Column(name="third_party", type="string", length=64, nullable=true)
     */
    #[Assert\Length(max: 64)]
    protected ?string $thirdParty = null;

    /**
     * @ORM\Column(name="notes", type="string", length=128, nullable=true)
     */
    #[Assert\Length(max: 128)]
    protected ?string $notes = null;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="value_date_start", type="date", nullable=true)
     */
    #[Assert\Type(type: 'DateTime')]
    protected $valueDateStart;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="value_date_end", type="date", nullable=true)
     */
    #[Assert\Type(type: 'DateTime')]
    protected $valueDateEnd;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_reconciled", type="boolean", nullable=true)
     */
    #[Assert\Type(type: 'bool')]
    protected $reconciled;

    /**
     * @ORM\Column(name="type", type="string", length=8, nullable=true, options={"default": "debit"})
     */
    #[Assert\Choice(choices: ['debit', 'credit'])]
    protected ?string $type = 'debit';

    /**
     * @ORM\Column(name="amount_inferior_to", type="integer", nullable=true)
     */
    protected ?int $amountInferiorTo = null;

    /**
     * @ORM\Column(name="amount_inferior_or_equal_to", type="integer", nullable=true)
     */
    protected ?int $amountInferiorOrEqualTo = null;

    /**
     * @ORM\Column(name="amount_equal_to", type="integer", nullable=true)
     */
    protected ?int $amountEqualTo = null;

    /**
     * @ORM\Column(name="amount_superior_or_equal_to", type="integer", nullable=true)
     */
    protected ?int $amountSuperiorOrEqualTo = null;

    /**
     * @ORM\Column(name="amount_superior_to", type="integer", nullable=true)
     */
    protected ?int $amountSuperiorTo = null;

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
