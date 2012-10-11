<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Entity;

use Doctrine\ORM\Mapping as ORM,
    Doctrine\Common\Collections\ArrayCollection,
    Symfony\Component\Validator\Constraints as Assert;

/**
 * Krevindiou\BagheeraBundle\Entity\Report
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="report")
 * @ORM\HasLifecycleCallbacks()
 */
class Report
{
    /**
     * @var integer $reportId
     *
     * @ORM\Column(name="report_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected $reportId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\User $user
     *
     * @ORM\ManyToOne(targetEntity="User", inversedBy="reports")
     * @ORM\JoinColumn(name="user_id", referencedColumnName="user_id", nullable=false)
     * @Assert\NotBlank()
     * @Assert\Valid()
     */
    protected $user;

    /**
     * @var string $type
     *
     * @ORM\Column(name="type", type="string", length=16, nullable=false)
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"sum", "average", "distribution", "estimate"})
     */
    protected $type;

    /**
     * @var string $title
     *
     * @ORM\Column(name="title", type="string", length=64, nullable=false)
     * @Assert\NotBlank()
     * @Assert\MaxLength(64)
     */
    protected $title;

    /**
     * @var boolean $homepage
     *
     * @ORM\Column(name="homepage", type="boolean", nullable=false)
     * @Assert\Type("bool")
     */
    protected $homepage = false;

    /**
     * @var DateTime $valueDateStart
     *
     * @ORM\Column(name="value_date_start", type="date", nullable=true)
     * @Assert\DateTime()
     */
    protected $valueDateStart;

    /**
     * @var DateTime $valueDateEnd
     *
     * @ORM\Column(name="value_date_end", type="date", nullable=true)
     * @Assert\DateTime()
     */
    protected $valueDateEnd;

    /**
     * @var string $thirdParties
     *
     * @ORM\Column(name="third_parties", type="string", length=255, nullable=true)
     */
    protected $thirdParties;

    /**
     * @var Doctrine\Common\Collections\Collection $categories
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
     * @var Doctrine\Common\Collections\Collection $paymentMethods
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
     * @var Doctrine\Common\Collections\Collection $accounts
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
     * @var boolean $reconciledOnly
     *
     * @ORM\Column(name="reconciled_only", type="boolean", nullable=true)
     * @Assert\Type("bool")
     */
    protected $reconciledOnly;

    /**
     * @var string $periodGrouping
     *
     * @ORM\Column(name="period_grouping", type="string", length=8, nullable=true)
     * @Assert\NotBlank(groups={"sum", "average"})
     * @Assert\Choice(choices = {"month", "quarter", "year", "all"})
     */
    protected $periodGrouping;

    /**
     * @var string $dataGrouping
     *
     * @ORM\Column(name="data_grouping", type="string", length=16, nullable=true)
     * @Assert\NotBlank(groups={"distribution"})
     * @Assert\Choice(choices = {"category", "third_party", "payment_method"})
     */
    protected $dataGrouping;

    /**
     * @var integer $significantResultsNumber
     *
     * @ORM\Column(name="significant_results_number", type="smallint", nullable=true)
     * @Assert\NotBlank(groups={"distribution"})
     */
    protected $significantResultsNumber;

    /**
     * @var integer $monthExpenses
     *
     * @ORM\Column(name="month_expenses", type="integer", nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     */
    protected $monthExpenses;

    /**
     * @var integer $monthIncomes
     *
     * @ORM\Column(name="month_incomes", type="integer", nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     */
    protected $monthIncomes;

    /**
     * @var integer $estimateDurationValue
     *
     * @ORM\Column(name="estimate_duration_value", type="smallint", nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     */
    protected $estimateDurationValue;

    /**
     * @var string $estimateDurationUnit
     *
     * @ORM\Column(name="estimate_duration_unit", type="string", length=8, nullable=true)
     * @Assert\NotBlank(groups={"estimate"})
     * @Assert\Choice(choices = {"month", "year"})
     */
    protected $estimateDurationUnit;

    /**
     * @var DateTime $createdAt
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     * @Assert\DateTime()
     */
    protected $createdAt;

    /**
     * @var DateTime $updatedAt
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
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
     * @ORM\PrePersist
     */
    public function prePersist()
    {
        $this->setCreatedAt(new \DateTime());
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * @ORM\PreUpdate
     */
    public function preUpdate()
    {
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * Get reportId
     *
     * @return integer
     */
    public function getReportId()
    {
        return $this->reportId;
    }

    /**
     * Set user
     *
     * @param Krevindiou\BagheeraBundle\Entity\User $user
     */
    public function setUser(User $user)
    {
        $this->user = $user;
    }

    /**
     * Get user
     *
     * @return Krevindiou\BagheeraBundle\Entity\User
     */
    public function getUser()
    {
        return $this->user;
    }

    /**
     * Set type
     *
     * @param string $type
     */
    public function setType($type)
    {
        $this->type = $type;
    }

    /**
     * Get type
     *
     * @return string
     */
    public function getType()
    {
        return $this->type;
    }

    /**
     * Set title
     *
     * @param string $title
     */
    public function setTitle($title)
    {
        $this->title = $title;
    }

    /**
     * Get title
     *
     * @return string
     */
    public function getTitle()
    {
        return $this->title;
    }

    /**
     * Set homepage
     *
     * @param boolean $homepage
     */
    public function setHomepage($homepage)
    {
        $this->homepage = (bool)$homepage;
    }

    /**
     * Get homepage
     *
     * @return boolean
     */
    public function getHomepage()
    {
        return $this->homepage;
    }

    /**
     * Set valueDateStart
     *
     * @param DateTime $valueDateStart
     */
    public function setValueDateStart(\DateTime $valueDateStart = null)
    {
        $this->valueDateStart = $valueDateStart;
    }

    /**
     * Get valueDateStart
     *
     * @return DateTime
     */
    public function getValueDateStart()
    {
        return $this->valueDateStart;
    }

    /**
     * Set valueDateEnd
     *
     * @param DateTime $valueDateEnd
     */
    public function setValueDateEnd(\DateTime $valueDateEnd = null)
    {
        $this->valueDateEnd = $valueDateEnd;
    }

    /**
     * Get valueDateEnd
     *
     * @return DateTime
     */
    public function getValueDateEnd()
    {
        return $this->valueDateEnd;
    }

    /**
     * Set thirdParties
     *
     * @param string $thirdParties
     */
    public function setThirdParties($thirdParties)
    {
        $this->thirdParties = $thirdParties;
    }

    /**
     * Get thirdParties
     *
     * @return string
     */
    public function getThirdParties()
    {
        return $this->thirdParties;
    }

    /**
     * Set categories
     *
     * @param array $categories
     */
    public function setCategories(array $categories)
    {
        $this->categories = $categories;
    }

    /**
     * Get categories
     *
     * @return array
     */
    public function getCategories()
    {
        return $this->categories;
    }

    /**
     * Set paymentMethods
     *
     * @param array $paymentMethods
     */
    public function setPaymentMethods(array $paymentMethods)
    {
        $this->paymentMethods = $paymentMethods;
    }

    /**
     * Get paymentMethods
     *
     * @return array
     */
    public function getPaymentMethods()
    {
        return $this->paymentMethods;
    }

    /**
     * Set accounts
     *
     * @param array $accounts
     */
    public function setAccounts(array $accounts)
    {
        $this->accounts = $accounts;
    }

    /**
     * Get accounts
     *
     * @return array
     */
    public function getAccounts()
    {
        return $this->accounts;
    }

    /**
     * Set reconciledOnly
     *
     * @param boolean $reconciledOnly
     */
    public function setReconciledOnly($reconciledOnly)
    {
        $this->reconciledOnly = $reconciledOnly;
    }

    /**
     * Get reconciledOnly
     *
     * @return boolean
     */
    public function getReconciledOnly()
    {
        return $this->reconciledOnly;
    }

    /**
     * Set periodGrouping
     *
     * @param string $periodGrouping
     */
    public function setPeriodGrouping($periodGrouping)
    {
        $this->periodGrouping = $periodGrouping;
    }

    /**
     * Get periodGrouping
     *
     * @return string
     */
    public function getPeriodGrouping()
    {
        return $this->periodGrouping;
    }

    /**
     * Set dataGrouping
     *
     * @param string $dataGrouping
     */
    public function setDataGrouping($dataGrouping)
    {
        $this->dataGrouping = $dataGrouping;
    }

    /**
     * Get dataGrouping
     *
     * @return string
     */
    public function getDataGrouping()
    {
        return $this->dataGrouping;
    }

    /**
     * Set significantResultsNumber
     *
     * @param integer $significantResultsNumber
     */
    public function setSignificantResultsNumber($significantResultsNumber)
    {
        $this->significantResultsNumber = $significantResultsNumber;
    }

    /**
     * Get significantResultsNumber
     *
     * @return integer
     */
    public function getSignificantResultsNumber()
    {
        return $this->significantResultsNumber;
    }

    /**
     * Set monthExpenses
     *
     * @param integer $monthExpenses
     */
    public function setMonthExpenses($monthExpenses)
    {
        $this->monthExpenses = $monthExpenses;
    }

    /**
     * Get monthExpenses
     *
     * @return integer
     */
    public function getMonthExpenses()
    {
        return $this->monthExpenses;
    }

    /**
     * Set monthIncomes
     *
     * @param integer $monthIncomes
     */
    public function setMonthIncomes($monthIncomes)
    {
        $this->monthIncomes = $monthIncomes;
    }

    /**
     * Get monthIncomes
     *
     * @return integer
     */
    public function getMonthIncomes()
    {
        return $this->monthIncomes;
    }

    /**
     * Set estimateDurationValue
     *
     * @param integer $estimateDurationValue
     */
    public function setEstimateDurationValue($estimateDurationValue)
    {
        $this->estimateDurationValue = $estimateDurationValue;
    }

    /**
     * Get estimateDurationValue
     *
     * @return integer
     */
    public function getEstimateDurationValue()
    {
        return $this->estimateDurationValue;
    }

    /**
     * Set estimateDurationUnit
     *
     * @param string $estimateDurationUnit
     */
    public function setEstimateDurationUnit($estimateDurationUnit)
    {
        $this->estimateDurationUnit = $estimateDurationUnit;
    }

    /**
     * Get estimateDurationUnit
     *
     * @return string
     */
    public function getEstimateDurationUnit()
    {
        return $this->estimateDurationUnit;
    }

    /**
     * Set createdAt
     *
     * @param DateTime $createdAt
     */
    public function setCreatedAt(\DateTime $createdAt)
    {
        $this->createdAt = $createdAt;
    }

    /**
     * Get createdAt
     *
     * @return DateTime
     */
    public function getCreatedAt()
    {
        return $this->createdAt;
    }

    /**
     * Set updatedAt
     *
     * @param DateTime $updatedAt
     */
    public function setUpdatedAt(\DateTime $updatedAt)
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * Get updatedAt
     *
     * @return DateTime
     */
    public function getUpdatedAt()
    {
        return $this->updatedAt;
    }
}
