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
    /**
     * @var int
     *
     * @ORM\Column(name="operation_search_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $operationSearchId;

    /**
     * @var Account
     *
     * @ORM\ManyToOne(targetEntity="Account", cascade={"all"}, fetch="EAGER")
     * @ORM\JoinColumn(name="account_id", referencedColumnName="account_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Account")
     * @Assert\Valid()
     */
    protected $account;

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
    protected $categories;

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
    protected $paymentMethods;

    /**
     * @var string
     *
     * @ORM\Column(name="third_party", type="string", length=64, nullable=true)
     * @Assert\Length(max = 64)
     */
    protected $thirdParty;

    /**
     * @var string
     *
     * @ORM\Column(name="notes", type="string", length=128, nullable=true)
     * @Assert\Length(max = 128)
     */
    protected $notes;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="value_date_start", type="date", nullable=true)
     * @Assert\Type("DateTime")
     */
    protected $valueDateStart;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="value_date_end", type="date", nullable=true)
     * @Assert\Type("DateTime")
     */
    protected $valueDateEnd;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_reconciled", type="boolean", nullable=true)
     * @Assert\Type("bool")
     */
    protected $reconciled;

    /**
     * @var string
     *
     * @ORM\Column(name="type", type="string", length=8, nullable=true)
     * @Assert\Choice(choices = {"debit", "credit"})
     */
    protected $type = 'debit';

    /**
     * @var decimal
     *
     * @ORM\Column(name="amount_inferior_to", type="decimal", scale=2, nullable=true)
     */
    protected $amountInferiorTo;

    /**
     * @var decimal
     *
     * @ORM\Column(name="amount_inferior_or_equal_to", type="decimal", scale=2, nullable=true)
     */
    protected $amountInferiorOrEqualTo;

    /**
     * @var decimal
     *
     * @ORM\Column(name="amount_equal_to", type="decimal", scale=2, nullable=true)
     */
    protected $amountEqualTo;

    /**
     * @var decimal
     *
     * @ORM\Column(name="amount_superior_or_equal_to", type="decimal", scale=2, nullable=true)
     */
    protected $amountSuperiorOrEqualTo;

    /**
     * @var decimal
     *
     * @ORM\Column(name="amount_superior_to", type="decimal", scale=2, nullable=true)
     */
    protected $amountSuperiorTo;

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

    public function __construct()
    {
        $this->categories = new ArrayCollection();
        $this->paymentMethods = new ArrayCollection();
    }

    /**
     * Get operationSearchId.
     *
     * @return int
     */
    public function getOperationSearchId(): ?int
    {
        return $this->operationSearchId;
    }

    /**
     * Set account.
     *
     * @param App\Entity\Account $account
     */
    public function setAccount(Account $account): void
    {
        $this->account = $account;
    }

    /**
     * Get account.
     *
     * @return App\Entity\Account
     */
    public function getAccount(): ?Account
    {
        return $this->account;
    }

    /**
     * Set categories.
     *
     * @param Doctrine\Common\Collections\Collection $categories
     */
    public function setCategories(Collection $categories): void
    {
        $this->categories = $categories;
    }

    /**
     * Get categories.
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getCategories(): Collection
    {
        return $this->categories;
    }

    /**
     * Set paymentMethods.
     *
     * @param Doctrine\Common\Collections\Collection $paymentMethods
     */
    public function setPaymentMethods(Collection $paymentMethods): void
    {
        $this->paymentMethods = $paymentMethods;
    }

    /**
     * Get paymentMethods.
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getPaymentMethods(): Collection
    {
        return $this->paymentMethods;
    }

    /**
     * Set thirdParty.
     *
     * @param string $thirdParty
     */
    public function setThirdParty(?string $thirdParty): void
    {
        $this->thirdParty = $thirdParty;
    }

    /**
     * Get thirdParty.
     *
     * @return string
     */
    public function getThirdParty(): ?string
    {
        return $this->thirdParty;
    }

    /**
     * Set notes.
     *
     * @param string $notes
     */
    public function setNotes(?string $notes): void
    {
        $this->notes = $notes;
    }

    /**
     * Get notes.
     *
     * @return string
     */
    public function getNotes(): ?string
    {
        return $this->notes;
    }

    /**
     * Set valueDateStart.
     *
     * @param DateTime $valueDateStart
     */
    public function setValueDateStart(?\DateTime $valueDateStart): void
    {
        $this->valueDateStart = $valueDateStart;
    }

    /**
     * Get valueDateStart.
     *
     * @return DateTime
     */
    public function getValueDateStart(): ?\DateTime
    {
        return $this->valueDateStart;
    }

    /**
     * Set valueDateEnd.
     *
     * @param DateTime $valueDateEnd
     */
    public function setValueDateEnd(?\DateTime $valueDateEnd): void
    {
        $this->valueDateEnd = $valueDateEnd;
    }

    /**
     * Get valueDateEnd.
     *
     * @return DateTime
     */
    public function getValueDateEnd(): ?\DateTime
    {
        return $this->valueDateEnd;
    }

    /**
     * Set reconciled.
     *
     * @param bool $reconciled
     */
    public function setReconciled(?bool $reconciled): void
    {
        $this->reconciled = $reconciled;
    }

    /**
     * Get reconciled.
     *
     * @return bool
     */
    public function isReconciled(): ?bool
    {
        return $this->reconciled;
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
     * Set amountInferiorTo.
     *
     * @param decimal $amountInferiorTo
     */
    public function setAmountInferiorTo($amountInferiorTo): void
    {
        $this->amountInferiorTo = $amountInferiorTo;
    }

    /**
     * Get amountInferiorTo.
     *
     * @return decimal
     */
    public function getAmountInferiorTo(): ?string
    {
        return $this->amountInferiorTo;
    }

    /**
     * Set amountInferiorOrEqualTo.
     *
     * @param decimal $amountInferiorOrEqualTo
     */
    public function setAmountInferiorOrEqualTo($amountInferiorOrEqualTo): void
    {
        $this->amountInferiorOrEqualTo = $amountInferiorOrEqualTo;
    }

    /**
     * Get amountInferiorOrEqualTo.
     *
     * @return decimal
     */
    public function getAmountInferiorOrEqualTo(): ?string
    {
        return $this->amountInferiorOrEqualTo;
    }

    /**
     * Set amountEqualTo.
     *
     * @param decimal $amountEqualTo
     */
    public function setAmountEqualTo($amountEqualTo): void
    {
        $this->amountEqualTo = $amountEqualTo;
    }

    /**
     * Get amountEqualTo.
     *
     * @return decimal
     */
    public function getAmountEqualTo(): ?string
    {
        return $this->amountEqualTo;
    }

    /**
     * Set amountSuperiorOrEqualTo.
     *
     * @param decimal $amountSuperiorOrEqualTo
     */
    public function setAmountSuperiorOrEqualTo($amountSuperiorOrEqualTo): void
    {
        $this->amountSuperiorOrEqualTo = $amountSuperiorOrEqualTo;
    }

    /**
     * Get amountSuperiorOrEqualTo.
     *
     * @return decimal
     */
    public function getAmountSuperiorOrEqualTo(): ?string
    {
        return $this->amountSuperiorOrEqualTo;
    }

    /**
     * Set amountSuperiorTo.
     *
     * @param decimal $amountSuperiorTo
     */
    public function setAmountSuperiorTo($amountSuperiorTo): void
    {
        $this->amountSuperiorTo = $amountSuperiorTo;
    }

    /**
     * Get amountSuperiorTo.
     *
     * @return decimal
     */
    public function getAmountSuperiorTo(): ?string
    {
        return $this->amountSuperiorTo;
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
