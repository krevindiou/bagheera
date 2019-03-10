<?php

declare(strict_types=1);

namespace App\Form\Model;

use Symfony\Component\Validator\Constraints as Assert;

class ReportFormModel
{
    public $reportId;

    /**
     * @Assert\NotBlank()
     * @Assert\Choice(choices = {"sum", "average", "distribution", "estimate"})
     */
    public $type;

    /**
     * @Assert\NotBlank()
     * @Assert\Length(max = 64)
     */
    public $title;

    /**
     * @Assert\Type("bool")
     */
    public $homepage;

    /**
     * @Assert\Type("DateTime")
     */
    public $valueDateStart;

    /**
     * @Assert\Type("DateTime")
     */
    public $valueDateEnd;

    public $thirdParties;

    public $accounts;

    /**
     * @Assert\Type("bool")
     */
    public $reconciledOnly;

    /**
     * @Assert\NotBlank(groups={"sum", "average"})
     * @Assert\Choice(choices = {"month", "quarter", "year", "all"})
     */
    public $periodGrouping;

    /**
     * @Assert\NotBlank(groups={"distribution"})
     * @Assert\Choice(choices = {"category", "third_party", "payment_method"})
     */
    public $dataGrouping;

    /**
     * @Assert\NotBlank(groups={"distribution"})
     */
    public $significantResultsNumber;

    /**
     * @Assert\NotBlank(groups={"estimate"})
     */
    public $monthExpenses;

    /**
     * @Assert\NotBlank(groups={"estimate"})
     */
    public $monthIncomes;

    /**
     * @Assert\NotBlank(groups={"estimate"})
     */
    public $estimateDurationValue;

    /**
     * @Assert\NotBlank(groups={"estimate"})
     * @Assert\Choice(choices = {"month", "year"})
     */
    public $estimateDurationUnit;

    public function __construct()
    {
        $this->homepage = false;
    }
}
