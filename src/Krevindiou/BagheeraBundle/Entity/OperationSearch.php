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
    Doctrine\Common\Collections\Collection,
    Doctrine\Common\Collections\ArrayCollection,
    Symfony\Component\Validator\Constraints as Assert;

/**
 * Krevindiou\BagheeraBundle\Entity\OperationSearch
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="operation_search")
 * @ORM\HasLifecycleCallbacks()
 */
class OperationSearch
{
    /**
     * @var integer $operationSearchId
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
     * @Assert\NotBlank()
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
     * @var string $thirdParty
     *
     * @ORM\Column(name="third_party", type="string", length=64, nullable=true)
     * @Assert\MaxLength(64)
     */
    protected $thirdParty;

    /**
     * @var string $notes
     *
     * @ORM\Column(name="notes", type="string", length=128, nullable=true)
     * @Assert\MaxLength(128)
     */
    protected $notes;

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
     * @var boolean $isReconciled
     *
     * @ORM\Column(name="is_reconciled", type="boolean", nullable=true)
     * @Assert\Type("bool")
     */
    protected $isReconciled;

    /**
     * @var string $type
     *
     * @ORM\Column(name="type", type="string", length=8, nullable=true)
     * @Assert\Choice(choices = {"debit", "credit"})
     */
    protected $type = 'debit';

    /**
     * @var decimal $amountInferiorTo
     *
     * @ORM\Column(name="amount_inferior_to", type="decimal", scale="2", nullable=true)
     */
    protected $amountInferiorTo;

    /**
     * @var decimal $amountInferiorOrEqualTo
     *
     * @ORM\Column(name="amount_inferior_or_equal_to", type="decimal", scale="2", nullable=true)
     */
    protected $amountInferiorOrEqualTo;

    /**
     * @var decimal $amountEqualTo
     *
     * @ORM\Column(name="amount_equal_to", type="decimal", scale="2", nullable=true)
     */
    protected $amountEqualTo;

    /**
     * @var decimal $amountSuperiorOrEqualTo
     *
     * @ORM\Column(name="amount_superior_or_equal_to", type="decimal", scale="2", nullable=true)
     */
    protected $amountSuperiorOrEqualTo;

    /**
     * @var decimal $amountSuperiorTo
     *
     * @ORM\Column(name="amount_superior_to", type="decimal", scale="2", nullable=true)
     */
    protected $amountSuperiorTo;

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
     * Get operationSearchId
     *
     * @return integer
     */
    public function getOperationSearchId()
    {
        return $this->operationSearchId;
    }

    /**
     * Set account
     *
     * @param Krevindiou\BagheeraBundle\Entity\Account $account
     */
    public function setAccount(Account $account)
    {
        $this->account = $account;
    }

    /**
     * Get account
     *
     * @return Krevindiou\BagheeraBundle\Entity\Account
     */
    public function getAccount()
    {
        return $this->account;
    }

    /**
     * Set categories
     *
     * @param Doctrine\Common\Collections\Collection $categories
     */
    public function setCategories(Collection $categories)
    {
        $this->categories = $categories;
    }

    /**
     * Get categories
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getCategories()
    {
        return $this->categories;
    }

    /**
     * Set paymentMethods
     *
     * @param Doctrine\Common\Collections\Collection $paymentMethods
     */
    public function setPaymentMethods(Collection $paymentMethods)
    {
        $this->paymentMethods = $paymentMethods;
    }

    /**
     * Get paymentMethods
     *
     * @return Doctrine\Common\Collections\Collection
     */
    public function getPaymentMethods()
    {
        return $this->paymentMethods;
    }

    /**
     * Set thirdParty
     *
     * @param string $thirdParty
     */
    public function setThirdParty($thirdParty)
    {
        $this->thirdParty = $thirdParty;
    }

    /**
     * Get thirdParty
     *
     * @return string
     */
    public function getThirdParty()
    {
        return $this->thirdParty;
    }

    /**
     * Set notes
     *
     * @param string $notes
     */
    public function setNotes($notes)
    {
        $this->notes = $notes;
    }

    /**
     * Get notes
     *
     * @return string
     */
    public function getNotes()
    {
        return $this->notes;
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
     * Set isReconciled
     *
     * @param boolean $isReconciled
     */
    public function setIsReconciled($isReconciled)
    {
        if ('' === $isReconciled) {
            $isReconciled = null;
        } else {
            $isReconciled = (bool)$isReconciled;
        }

        $this->isReconciled = $isReconciled;
    }

    /**
     * Get isReconciled
     *
     * @return boolean
     */
    public function getIsReconciled()
    {
        return $this->isReconciled;
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
     * Set amountInferiorTo
     *
     * @param decimal $amountInferiorTo
     */
    public function setAmountInferiorTo($amountInferiorTo)
    {
        $this->amountInferiorTo = $amountInferiorTo;
    }

    /**
     * Get amountInferiorTo
     *
     * @return decimal
     */
    public function getAmountInferiorTo()
    {
        return $this->amountInferiorTo;
    }

    /**
     * Set amountInferiorOrEqualTo
     *
     * @param decimal $amountInferiorOrEqualTo
     */
    public function setAmountInferiorOrEqualTo($amountInferiorOrEqualTo)
    {
        $this->amountInferiorOrEqualTo = $amountInferiorOrEqualTo;
    }

    /**
     * Get amountInferiorOrEqualTo
     *
     * @return decimal
     */
    public function getAmountInferiorOrEqualTo()
    {
        return $this->amountInferiorOrEqualTo;
    }

    /**
     * Set amountEqualTo
     *
     * @param decimal $amountEqualTo
     */
    public function setAmountEqualTo($amountEqualTo)
    {
        $this->amountEqualTo = $amountEqualTo;
    }

    /**
     * Get amountEqualTo
     *
     * @return decimal
     */
    public function getAmountEqualTo()
    {
        return $this->amountEqualTo;
    }

    /**
     * Set amountSuperiorOrEqualTo
     *
     * @param decimal $amountSuperiorOrEqualTo
     */
    public function setAmountSuperiorOrEqualTo($amountSuperiorOrEqualTo)
    {
        $this->amountSuperiorOrEqualTo = $amountSuperiorOrEqualTo;
    }

    /**
     * Get amountSuperiorOrEqualTo
     *
     * @return decimal
     */
    public function getAmountSuperiorOrEqualTo()
    {
        return $this->amountSuperiorOrEqualTo;
    }

    /**
     * Set amountSuperiorTo
     *
     * @param decimal $amountSuperiorTo
     */
    public function setAmountSuperiorTo($amountSuperiorTo)
    {
        $this->amountSuperiorTo = $amountSuperiorTo;
    }

    /**
     * Get amountSuperiorTo
     *
     * @return decimal
     */
    public function getAmountSuperiorTo()
    {
        return $this->amountSuperiorTo;
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
