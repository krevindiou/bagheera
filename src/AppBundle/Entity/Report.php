<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Entity;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\Collection;
use Doctrine\Common\Collections\ArrayCollection;
use Symfony\Component\Validator\Constraints as Assert;
use Gedmo\Mapping\Annotation as Gedmo;

/**
 * @ORM\Entity
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
     * @var AppBundle\Entity\Member
     *
     * @ORM\ManyToOne(targetEntity="Member", inversedBy="reports")
     * @ORM\JoinColumn(name="member_id", referencedColumnName="member_id", nullable=false)
     * @Assert\NotBlank()
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
     * @Assert\DateTime()
     */
    protected $valueDateStart;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="value_date_end", type="date", nullable=true)
     * @Assert\DateTime()
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
     * @Gedmo\Timestampable(on="create")
     * @Assert\DateTime()
     */
    protected $createdAt;

    /**
     * @var DateTime
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     * @Gedmo\Timestampable(on="update")
     * @Assert\DateTime()
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
    public function getReportId()
    {
        return $this->reportId;
    }

    /**
     * Set member.
     *
     * @param AppBundle\Entity\Member $member
     */
    public function setMember(Member $member)
    {
        $this->member = $member;
    }

    /**
     * Get member.
     *
     * @return AppBundle\Entity\Member
     */
    public function getMember()
    {
        return $this->member;
    }

    /**
     * Set type.
     *
     * @param string $type
     */
    public function setType($type)
    {
        $this->type = $type;
    }

    /**
     * Get type.
     *
     * @return string
     */
    public function getType()
    {
        return $this->type;
    }

    /**
     * Set title.
     *
     * @param string $title
     */
    public function setTitle($title)
    {
        $this->title = $title;
    }

    /**
     * Get title.
     *
     * @return string
     */
    public function getTitle()
    {
        return $this->title;
    }

    /**
     * Set homepage.
     *
     * @param bool $homepage
     */
    public function setHomepage($homepage)
    {
        $this->homepage = (bool) $homepage;
    }

    /**
     * Get homepage.
     *
     * @return bool
     */
    public function getHomepage()
    {
        return $this->homepage;
    }

    /**
     * Set valueDateStart.
     *
     * @param DateTime $valueDateStart
     */
    public function setValueDateStart(\DateTime $valueDateStart = null)
    {
        $this->valueDateStart = $valueDateStart;
    }

    /**
     * Get valueDateStart.
     *
     * @return DateTime
     */
    public function getValueDateStart()
    {
        return $this->valueDateStart;
    }

    /**
     * Set valueDateEnd.
     *
     * @param DateTime $valueDateEnd
     */
    public function setValueDateEnd(\DateTime $valueDateEnd = null)
    {
        $this->valueDateEnd = $valueDateEnd;
    }

    /**
     * Get valueDateEnd.
     *
     * @return DateTime
     */
    public function getValueDateEnd()
    {
        return $this->valueDateEnd;
    }

    /**
     * Set thirdParties.
     *
     * @param string $thirdParties
     */
    public function setThirdParties($thirdParties)
    {
        $this->thirdParties = $thirdParties;
    }

    /**
     * Get thirdParties.
     *
     * @return string
     */
    public function getThirdParties()
    {
        return $this->thirdParties;
    }

    /**
     * Set categories.
     *
     * @param array $categories
     */
    public function setCategories(array $categories)
    {
        $this->categories = $categories;
    }

    /**
     * Get categories.
     *
     * @return array
     */
    public function getCategories()
    {
        return $this->categories;
    }

    /**
     * Set paymentMethods.
     *
     * @param array $paymentMethods
     */
    public function setPaymentMethods(array $paymentMethods)
    {
        $this->paymentMethods = $paymentMethods;
    }

    /**
     * Get paymentMethods.
     *
     * @return array
     */
    public function getPaymentMethods()
    {
        return $this->paymentMethods;
    }

    /**
     * Set accounts.
     *
     * @param array                                  $accounts
     * @param Doctrine\Common\Collections\Collection $accounts
     */
    public function setAccounts(Collection $accounts = null)
    {
        $this->accounts = $accounts;
    }

    /**
     * Get accounts.
     *
     * @return array
     */
    public function getAccounts()
    {
        return $this->accounts;
    }

    /**
     * Set reconciledOnly.
     *
     * @param bool $reconciledOnly
     */
    public function setReconciledOnly($reconciledOnly)
    {
        $this->reconciledOnly = $reconciledOnly;
    }

    /**
     * Get reconciledOnly.
     *
     * @return bool
     */
    public function getReconciledOnly()
    {
        return $this->reconciledOnly;
    }

    /**
     * Set periodGrouping.
     *
     * @param string $periodGrouping
     */
    public function setPeriodGrouping($periodGrouping)
    {
        $this->periodGrouping = $periodGrouping;
    }

    /**
     * Get periodGrouping.
     *
     * @return string
     */
    public function getPeriodGrouping()
    {
        return $this->periodGrouping;
    }

    /**
     * Set dataGrouping.
     *
     * @param string $dataGrouping
     */
    public function setDataGrouping($dataGrouping)
    {
        $this->dataGrouping = $dataGrouping;
    }

    /**
     * Get dataGrouping.
     *
     * @return string
     */
    public function getDataGrouping()
    {
        return $this->dataGrouping;
    }

    /**
     * Set significantResultsNumber.
     *
     * @param int $significantResultsNumber
     */
    public function setSignificantResultsNumber($significantResultsNumber)
    {
        $this->significantResultsNumber = $significantResultsNumber;
    }

    /**
     * Get significantResultsNumber.
     *
     * @return int
     */
    public function getSignificantResultsNumber()
    {
        return $this->significantResultsNumber;
    }

    /**
     * Set monthExpenses.
     *
     * @param int $monthExpenses
     */
    public function setMonthExpenses($monthExpenses)
    {
        $this->monthExpenses = $monthExpenses;
    }

    /**
     * Get monthExpenses.
     *
     * @return int
     */
    public function getMonthExpenses()
    {
        return $this->monthExpenses;
    }

    /**
     * Set monthIncomes.
     *
     * @param int $monthIncomes
     */
    public function setMonthIncomes($monthIncomes)
    {
        $this->monthIncomes = $monthIncomes;
    }

    /**
     * Get monthIncomes.
     *
     * @return int
     */
    public function getMonthIncomes()
    {
        return $this->monthIncomes;
    }

    /**
     * Set estimateDurationValue.
     *
     * @param int $estimateDurationValue
     */
    public function setEstimateDurationValue($estimateDurationValue)
    {
        $this->estimateDurationValue = $estimateDurationValue;
    }

    /**
     * Get estimateDurationValue.
     *
     * @return int
     */
    public function getEstimateDurationValue()
    {
        return $this->estimateDurationValue;
    }

    /**
     * Set estimateDurationUnit.
     *
     * @param string $estimateDurationUnit
     */
    public function setEstimateDurationUnit($estimateDurationUnit)
    {
        $this->estimateDurationUnit = $estimateDurationUnit;
    }

    /**
     * Get estimateDurationUnit.
     *
     * @return string
     */
    public function getEstimateDurationUnit()
    {
        return $this->estimateDurationUnit;
    }

    /**
     * Set createdAt.
     *
     * @param DateTime $createdAt
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->createdAt = $createdAt;
    }

    /**
     * Get createdAt.
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->createdAt;
    }

    /**
     * Set updatedAt.
     *
     * @param DateTime $updatedAt
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * Get updatedAt.
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }
}
