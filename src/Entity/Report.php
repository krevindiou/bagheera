<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\ReportRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
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

#[Entity(repositoryClass: ReportRepository::class)]
#[Table(name: 'report')]
class Report
{
    use TimestampableTrait;

    #[Id, Column(name: 'report_id', type: 'integer')]
    #[GeneratedValue(strategy: 'IDENTITY')]
    protected ?int $reportId = null;

    #[Assert\NotNull]
    #[Assert\Type(type: Member::class)]
    #[ManyToOne(targetEntity: Member::class, inversedBy: 'reports')]
    #[JoinColumn(name: 'member_id', referencedColumnName: 'member_id', nullable: false)]
    protected ?Member $member = null;

    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['sum', 'average', 'distribution', 'estimate'])]
    #[Column(name: 'type', type: 'string', length: 16)]
    protected ?string $type = null;

    #[Assert\NotBlank]
    #[Assert\Length(max: 64)]
    #[Column(name: 'title', type: 'string', length: 64)]
    protected ?string $title = null;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'homepage', type: 'boolean', options: ['default' => false])]
    protected ?bool $homepage = false;

    #[Assert\Type(type: \DateTime::class)]
    #[Column(name: 'value_date_start', type: 'date', nullable: true)]
    protected ?\DateTime $valueDateStart = null;

    #[Assert\Type(type: \DateTime::class)]
    #[Column(name: 'value_date_end', type: 'date', nullable: true)]
    protected ?\DateTime $valueDateEnd = null;

    #[Column(name: 'third_parties', type: 'string', length: 255, nullable: true)]
    protected ?string $thirdParties = null;

    #[ManyToMany(targetEntity: Category::class, fetch: 'EAGER')]
    #[JoinTable(name: 'report_category')]
    #[JoinColumn(name: 'report_id', referencedColumnName: 'report_id')]
    #[InverseJoinColumn(name: 'category_id', referencedColumnName: 'category_id')]
    protected Collection $categories;

    #[ManyToMany(targetEntity: PaymentMethod::class, fetch: 'EAGER')]
    #[JoinTable(name: 'report_payment_method')]
    #[JoinColumn(name: 'report_id', referencedColumnName: 'report_id')]
    #[InverseJoinColumn(name: 'payment_method_id', referencedColumnName: 'payment_method_id')]
    protected Collection $paymentMethods;

    #[ManyToMany(targetEntity: Account::class, fetch: 'EAGER')]
    #[JoinTable(name: 'report_account')]
    #[JoinColumn(name: 'report_id', referencedColumnName: 'report_id')]
    #[InverseJoinColumn(name: 'account_id', referencedColumnName: 'account_id')]
    protected Collection $accounts;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'reconciled_only', type: 'boolean', nullable: true)]
    protected ?bool $reconciledOnly = null;

    #[Assert\NotBlank(groups: ['sum', 'average'])]
    #[Assert\Choice(choices: ['month', 'quarter', 'year', 'all'])]
    #[Column(name: 'period_grouping', type: 'string', length: 8, nullable: true)]
    protected ?string $periodGrouping = null;

    #[Assert\NotBlank(groups: ['distribution'])]
    #[Assert\Choice(choices: ['category', 'third_party', 'payment_method'])]
    #[Column(name: 'data_grouping', type: 'string', length: 16, nullable: true)]
    protected ?string $dataGrouping = null;

    #[Assert\NotBlank(groups: ['distribution'])]
    #[Column(name: 'significant_results_number', type: 'smallint', nullable: true)]
    protected ?int $significantResultsNumber = null;

    #[Assert\NotBlank(groups: ['estimate'])]
    #[Column(name: 'month_expenses', type: 'integer', nullable: true)]
    protected ?int $monthExpenses = null;

    #[Assert\NotBlank(groups: ['estimate'])]
    #[Column(name: 'month_incomes', type: 'integer', nullable: true)]
    protected ?int $monthIncomes = null;

    #[Assert\NotBlank(groups: ['estimate'])]
    #[Column(name: 'estimate_duration_value', type: 'smallint', nullable: true)]
    protected ?int $estimateDurationValue = null;

    #[Assert\NotBlank(groups: ['estimate'])]
    #[Assert\Choice(choices: ['month', 'year'])]
    #[Column(name: 'estimate_duration_unit', type: 'string', length: 8, nullable: true)]
    protected ?int $estimateDurationUnit = null;

    public function __construct()
    {
        $this->accounts = new ArrayCollection();
        $this->categories = new ArrayCollection();
        $this->paymentMethods = new ArrayCollection();
    }

    public function setReportId(?int $reportId): void
    {
        $this->reportId = $reportId;
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

    public function setThirdParties(?string $thirdParties): void
    {
        $this->thirdParties = $thirdParties;
    }

    public function getThirdParties(): ?string
    {
        return $this->thirdParties;
    }

    public function setCategories(Collection $categories): void
    {
        $this->categories = $categories;
    }

    public function getCategories(): ?Collection
    {
        return $this->categories;
    }

    public function setPaymentMethods(Collection $paymentMethods): void
    {
        $this->paymentMethods = $paymentMethods;
    }

    public function getPaymentMethods(): ?Collection
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

    public function setDataGrouping(?string $dataGrouping): void
    {
        $this->dataGrouping = $dataGrouping;
    }

    public function getDataGrouping(): ?string
    {
        return $this->dataGrouping;
    }

    public function setSignificantResultsNumber(?int $significantResultsNumber): void
    {
        $this->significantResultsNumber = $significantResultsNumber;
    }

    public function getSignificantResultsNumber(): ?int
    {
        return $this->significantResultsNumber;
    }

    public function setMonthExpenses(?int $monthExpenses): void
    {
        $this->monthExpenses = $monthExpenses;
    }

    public function getMonthExpenses(): ?int
    {
        return $this->monthExpenses;
    }

    public function setMonthIncomes(?int $monthIncomes): void
    {
        $this->monthIncomes = $monthIncomes;
    }

    public function getMonthIncomes(): ?int
    {
        return $this->monthIncomes;
    }

    public function setEstimateDurationValue(?int $estimateDurationValue): void
    {
        $this->estimateDurationValue = $estimateDurationValue;
    }

    public function getEstimateDurationValue(): ?int
    {
        return $this->estimateDurationValue;
    }

    public function setEstimateDurationUnit(?int $estimateDurationUnit): void
    {
        $this->estimateDurationUnit = $estimateDurationUnit;
    }

    public function getEstimateDurationUnit(): ?int
    {
        return $this->estimateDurationUnit;
    }
}
