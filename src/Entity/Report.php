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
     * @ORM\Column(name="report_id", type="integer", nullable=false)
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
     * @ORM\Column(name="type", type="string", length=16, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"sum", "average", "distribution", "estimate"})
     */
    protected $type;

    /**
     * @var string
     *
     * @ORM\Column(name="title", type="string", length=64, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Length(max = 64)
     */
    protected $title;

    /**
     * @var bool
     *
     * @ORM\Column(name="homepage", type="boolean", nullable=false)
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
        $this->accounts = new ArrayCollection();
        $this->categories = new ArrayCollection();
        $this->paymentMethods = new ArrayCollection();
    }

    /**
     * Get reportId.
     *
     * @return int
     */
    public function getReportId(): ?int
    {
        return $this->reportId;
    }

    /**
     * Set member.
     *
     * @param App\Entity\Member $member
     */
    public function setMember(Member $member): void
    {
        $this->member = $member;
    }

    /**
     * Get member.
     *
     * @return App\Entity\Member
     */
    public function getMember(): ?Member
    {
        return $this->member;
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
     * Set title.
     *
     * @param string $title
     */
    public function setTitle(string $title): void
    {
        $this->title = $title;
    }

    /**
     * Get title.
     *
     * @return string
     */
    public function getTitle(): ?string
    {
        return $this->title;
    }

    /**
     * Set homepage.
     *
     * @param bool $homepage
     */
    public function setHomepage(bool $homepage): void
    {
        $this->homepage = $homepage;
    }

    /**
     * Get homepage.
     *
     * @return bool
     */
    public function getHomepage(): ?bool
    {
        return $this->homepage;
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
     * Set thirdParties.
     *
     * @param string $thirdParties
     */
    public function setThirdParties(string $thirdParties): void
    {
        $this->thirdParties = $thirdParties;
    }

    /**
     * Get thirdParties.
     *
     * @return string
     */
    public function getThirdParties(): ?string
    {
        return $this->thirdParties;
    }

    /**
     * Set categories.
     *
     * @param array $categories
     */
    public function setCategories(array $categories): void
    {
        $this->categories = $categories;
    }

    /**
     * Get categories.
     *
     * @return array
     */
    public function getCategories(): ?array
    {
        return $this->categories;
    }

    /**
     * Set paymentMethods.
     *
     * @param array $paymentMethods
     */
    public function setPaymentMethods(array $paymentMethods): void
    {
        $this->paymentMethods = $paymentMethods;
    }

    /**
     * Get paymentMethods.
     *
     * @return array
     */
    public function getPaymentMethods(): ?array
    {
        return $this->paymentMethods;
    }

    /**
     * Set accounts.
     *
     * @param array                                  $accounts
     * @param Doctrine\Common\Collections\Collection $accounts
     */
    public function setAccounts(?Collection $accounts): void
    {
        $this->accounts = $accounts;
    }

    /**
     * Get accounts.
     *
     * @return array
     */
    public function getAccounts(): Collection
    {
        return $this->accounts;
    }

    /**
     * Set reconciledOnly.
     *
     * @param bool $reconciledOnly
     */
    public function setReconciledOnly(bool $reconciledOnly): void
    {
        $this->reconciledOnly = $reconciledOnly;
    }

    /**
     * Get reconciledOnly.
     *
     * @return bool
     */
    public function getReconciledOnly(): ?bool
    {
        return $this->reconciledOnly;
    }

    /**
     * Set periodGrouping.
     *
     * @param string $periodGrouping
     */
    public function setPeriodGrouping(string $periodGrouping): void
    {
        $this->periodGrouping = $periodGrouping;
    }

    /**
     * Get periodGrouping.
     *
     * @return string
     */
    public function getPeriodGrouping(): ?string
    {
        return $this->periodGrouping;
    }

    /**
     * Set dataGrouping.
     *
     * @param string $dataGrouping
     */
    public function setDataGrouping(string $dataGrouping): void
    {
        $this->dataGrouping = $dataGrouping;
    }

    /**
     * Get dataGrouping.
     *
     * @return string
     */
    public function getDataGrouping(): ?string
    {
        return $this->dataGrouping;
    }

    /**
     * Set significantResultsNumber.
     *
     * @param int $significantResultsNumber
     */
    public function setSignificantResultsNumber(int $significantResultsNumber): void
    {
        $this->significantResultsNumber = $significantResultsNumber;
    }

    /**
     * Get significantResultsNumber.
     *
     * @return int
     */
    public function getSignificantResultsNumber(): ?int
    {
        return $this->significantResultsNumber;
    }

    /**
     * Set monthExpenses.
     *
     * @param int $monthExpenses
     */
    public function setMonthExpenses(int $monthExpenses): void
    {
        $this->monthExpenses = $monthExpenses;
    }

    /**
     * Get monthExpenses.
     *
     * @return int
     */
    public function getMonthExpenses(): ?int
    {
        return $this->monthExpenses;
    }

    /**
     * Set monthIncomes.
     *
     * @param int $monthIncomes
     */
    public function setMonthIncomes(int $monthIncomes): void
    {
        $this->monthIncomes = $monthIncomes;
    }

    /**
     * Get monthIncomes.
     *
     * @return int
     */
    public function getMonthIncomes(): ?int
    {
        return $this->monthIncomes;
    }

    /**
     * Set estimateDurationValue.
     *
     * @param int $estimateDurationValue
     */
    public function setEstimateDurationValue(int $estimateDurationValue): void
    {
        $this->estimateDurationValue = $estimateDurationValue;
    }

    /**
     * Get estimateDurationValue.
     *
     * @return int
     */
    public function getEstimateDurationValue(): ?int
    {
        return $this->estimateDurationValue;
    }

    /**
     * Set estimateDurationUnit.
     *
     * @param string $estimateDurationUnit
     */
    public function setEstimateDurationUnit(int $estimateDurationUnit): void
    {
        $this->estimateDurationUnit = $estimateDurationUnit;
    }

    /**
     * Get estimateDurationUnit.
     *
     * @return string
     */
    public function getEstimateDurationUnit(): ?int
    {
        return $this->estimateDurationUnit;
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
