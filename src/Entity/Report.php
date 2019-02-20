<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\ReportRepository")
 * @ORM\Table(name="report")
 */
class Report
{
    /**
     * @var int
     *
     * @ORM\Column(name="report_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $reportId;

    /**
     * @var App\Entity\Member
     *
     * @ORM\ManyToOne(targetEntity="Member", inversedBy="reports")
     * @ORM\JoinColumn(name="member_id", referencedColumnName="member_id", nullable=false)
     * @Assert\NotNull()
     * @Assert\Type(type="App\Entity\Member")
     * @Assert\Valid()
     */
    protected $member;

    /**
     * @var string
     *
     * @ORM\Column(name="type", type="string", length=16)
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"sum", "average", "distribution", "estimate"})
     */
    protected $type;

    /**
     * @var string
     *
     * @ORM\Column(name="title", type="string", length=64)
     * @Assert\NotBlank()
     * @Assert\Length(max = 64)
     */
    protected $title;

    /**
     * @var bool
     *
     * @ORM\Column(name="homepage", type="boolean", options={"default": false})
     * @Assert\Type("bool")
     */
    protected $homepage = false;

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
     * @var string
     *
     * @ORM\Column(name="third_parties", type="string", length=255, nullable=true)
     */
    protected $thirdParties;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\ManyToMany(targetEntity="Category", fetch="EAGER")
     * @ORM\JoinTable(name="report_category",
     *   joinColumns={
     *     @ORM\JoinColumn(name="report_id", referencedColumnName="report_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="category_id", referencedColumnName="category_id")
     *   }
     * )
     */
    protected $categories;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\ManyToMany(targetEntity="PaymentMethod", fetch="EAGER")
     * @ORM\JoinTable(name="report_payment_method",
     *   joinColumns={
     *     @ORM\JoinColumn(name="report_id", referencedColumnName="report_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="payment_method_id", referencedColumnName="payment_method_id")
     *   }
     * )
     */
    protected $paymentMethods;

    /**
     * @var Doctrine\Common\Collections\Collection
     *
     * @ORM\ManyToMany(targetEntity="Account", fetch="EAGER")
     * @ORM\JoinTable(name="report_account",
     *   joinColumns={
     *     @ORM\JoinColumn(name="report_id", referencedColumnName="report_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="account_id", referencedColumnName="account_id")
     *   }
     * )
     */
    protected $accounts;

    /**
     * @var bool
     *
     * @ORM\Column(name="reconciled_only", type="boolean", nullable=true)
     * @Assert\Type("bool")
     */
    protected $reconciledOnly;

    /**
     * @var string
     *
     * @ORM\Column(name="period_grouping", type="string", length=8, nullable=true)
     * @Assert\NotBlank(groups={"sum", "average"})
     * @Assert\Choice(choices = {"month", "quarter", "year", "all"})
     */
    protected $periodGrouping;

    /**
     * @var string
     *
     * @ORM\Column(name="data_grouping", type="string", length=16, nullable=true)
     * @Assert\NotBlank(groups={"distribution"})
     * @Assert\Choice(choices = {"category", "third_party", "payment_method"})
     */
    protected $dataGrouping;

    /**
     * @var int
     *
     * @ORM\Column(name="significant_results_number", type="smallint", nullable=true)
     * @Assert\NotBlank(groups={"distribution"})
     */
    protected $significantResultsNumber;

    /**
     * @var int
     *
     * @ORM\Column(name="month_expenses", type="integer", nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     */
    protected $monthExpenses;

    /**
     * @var int
     *
     * @ORM\Column(name="month_incomes", type="integer", nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     */
    protected $monthIncomes;

    /**
     * @var int
     *
     * @ORM\Column(name="estimate_duration_value", type="smallint", nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     */
    protected $estimateDurationValue;

    /**
     * @var string
     *
     * @ORM\Column(name="estimate_duration_unit", type="string", length=8, nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     * @Assert\Choice(choices = {"month", "year"})
     */
    protected $estimateDurationUnit;

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

    public function __construct()
    {
        $this->accounts = new ArrayCollection();
        $this->categories = new ArrayCollection();
        $this->paymentMethods = new ArrayCollection();
    }

    public function getReportId(): ?int
    {
        return $this->reportId;
    }

    public function setMember(Member $member): void
    {
        $this->member = $member;
    }

    public function getMember(): ?Member
    {
        return $this->member;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setTitle(string $title): void
    {
        $this->title = $title;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setHomepage(bool $homepage): void
    {
        $this->homepage = $homepage;
    }

    public function getHomepage(): ?bool
    {
        return $this->homepage;
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

    public function setThirdParties(string $thirdParties): void
    {
        $this->thirdParties = $thirdParties;
    }

    public function getThirdParties(): ?string
    {
        return $this->thirdParties;
    }

    public function setCategories(array $categories): void
    {
        $this->categories = $categories;
    }

    public function getCategories(): ?array
    {
        return $this->categories;
    }

    public function setPaymentMethods(array $paymentMethods): void
    {
        $this->paymentMethods = $paymentMethods;
    }

    public function getPaymentMethods(): ?array
    {
        return $this->paymentMethods;
    }

    public function setAccounts(?Collection $accounts): void
    {
        $this->accounts = $accounts;
    }

    public function getAccounts(): Collection
    {
        return $this->accounts;
    }

    public function setReconciledOnly(bool $reconciledOnly): void
    {
        $this->reconciledOnly = $reconciledOnly;
    }

    public function getReconciledOnly(): ?bool
    {
        return $this->reconciledOnly;
    }

    public function setPeriodGrouping(string $periodGrouping): void
    {
        $this->periodGrouping = $periodGrouping;
    }

    public function getPeriodGrouping(): ?string
    {
        return $this->periodGrouping;
    }

    public function setDataGrouping(string $dataGrouping): void
    {
        $this->dataGrouping = $dataGrouping;
    }

    public function getDataGrouping(): ?string
    {
        return $this->dataGrouping;
    }

    public function setSignificantResultsNumber(int $significantResultsNumber): void
    {
        $this->significantResultsNumber = $significantResultsNumber;
    }

    public function getSignificantResultsNumber(): ?int
    {
        return $this->significantResultsNumber;
    }

    public function setMonthExpenses(int $monthExpenses): void
    {
        $this->monthExpenses = $monthExpenses;
    }

    public function getMonthExpenses(): ?int
    {
        return $this->monthExpenses;
    }

    public function setMonthIncomes(int $monthIncomes): void
    {
        $this->monthIncomes = $monthIncomes;
    }

    public function getMonthIncomes(): ?int
    {
        return $this->monthIncomes;
    }

    public function setEstimateDurationValue(int $estimateDurationValue): void
    {
        $this->estimateDurationValue = $estimateDurationValue;
    }

    public function getEstimateDurationValue(): ?int
    {
        return $this->estimateDurationValue;
    }

    public function setEstimateDurationUnit(int $estimateDurationUnit): void
    {
        $this->estimateDurationUnit = $estimateDurationUnit;
    }

    public function getEstimateDurationUnit(): ?int
    {
        return $this->estimateDurationUnit;
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
