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

use Doctrine\ORM\Mapping as ORM;

/**
 * Krevindiou\BagheeraBundle\Entity\Account
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 * @ORM\Entity
 * @ORM\Table(name="account")
 * @ORM\HasLifecycleCallbacks()
 */
class Account
{
    /**
     * @var integer $accountId
     *
     * @ORM\Column(name="account_id", type="integer", nullable=false)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    private $accountId;

    /**
     * @var string $name
     *
     * @ORM\Column(name="name", type="string", length=32, nullable=false)
     */
    private $name;

    /**
     * @var float $initialBalance
     *
     * @ORM\Column(name="initial_balance", type="decimal", nullable=false)
     */
    private $initialBalance;

    /**
     * @var float $overdraftFacility
     *
     * @ORM\Column(name="overdraft_facility", type="decimal", nullable=false)
     */
    private $overdraftFacility;

    /**
     * @var string $details
     *
     * @ORM\Column(name="details", type="string", length=64, nullable=true)
     */
    private $details;

    /**
     * @var DateTime $createdAt
     *
     * @ORM\Column(name="created_at", type="datetime", nullable=false)
     */
    private $createdAt;

    /**
     * @var DateTime $updatedAt
     *
     * @ORM\Column(name="updated_at", type="datetime", nullable=false)
     */
    private $updatedAt;

    /**
     * @var Doctrine\Common\Collections\ArrayCollection $sharedWith
     *
     * @ORM\ManyToMany(targetEntity="User")
     * @ORM\JoinTable(name="shared_account",
     *   joinColumns={
     *     @ORM\JoinColumn(name="account_id", referencedColumnName="account_id")
     *   },
     *   inverseJoinColumns={
     *     @ORM\JoinColumn(name="user_id", referencedColumnName="user_id")
     *   }
     * )
     * @ORM\OrderBy({"lastname" = "ASC"})
     */
    private $sharedWith;

    /**
     * @var integer $bankId
     *
     * @ORM\Column(name="bank_id", type="integer", nullable=false)
     */
    private $bankId;

    /**
     * @var Krevindiou\BagheeraBundle\Entity\Bank $bank
     *
     * @ORM\ManyToOne(targetEntity="Bank")
     * @ORM\JoinColumns({
     *   @ORM\JoinColumn(name="bank_id", referencedColumnName="bank_id")
     * })
     */
    private $bank;

    /**
     * @var Doctrine\Common\Collections\ArrayCollection
     *
     * @ORM\OneToMany(targetEntity="Transaction", mappedBy="account", cascade={"all"}, fetch="LAZY")
     */
    private $transactions;

    /**
     * @var Doctrine\Common\Collections\ArrayCollection
     *
     * @ORM\OneToMany(targetEntity="Scheduler", mappedBy="account", cascade={"all"}, fetch="LAZY")
     */
    private $schedulers;


    public function __construct()
    {
        $this->sharedWith = new \Doctrine\Common\Collections\ArrayCollection();
    }

    /**
     * @ORM\prePersist
     */
    public function prePersist()
    {
        if (null == $this->getAccountId()) {
            $this->setCreatedAt(new \DateTime());
        }
        $this->setUpdatedAt(new \DateTime());
    }

    /**
     * Get accountId
     *
     * @return integer
     */
    public function getAccountId()
    {
        return $this->accountId;
    }

    /**
     * Set name
     *
     * @param string $name
     */
    public function setName($name)
    {
        $this->name = $name;
    }

    /**
     * Get name
     *
     * @return string
     */
    public function getName()
    {
        return $this->name;
    }

    /**
     * Set initialBalance
     *
     * @param float $initialBalance
     */
    public function setInitialBalance($initialBalance)
    {
        $this->initialBalance = $initialBalance;
    }

    /**
     * Get initialBalance
     *
     * @return float
     */
    public function getInitialBalance()
    {
        return $this->initialBalance;
    }

    /**
     * Set overdraftFacility
     *
     * @param float $overdraftFacility
     */
    public function setOverdraftFacility($overdraftFacility)
    {
        $this->overdraftFacility = $overdraftFacility;
    }

    /**
     * Get overdraftFacility
     *
     * @return float
     */
    public function getOverdraftFacility()
    {
        return $this->overdraftFacility;
    }

    /**
     * Set details
     *
     * @param string $details
     */
    public function setDetails($details)
    {
        $this->details = $details;
    }

    /**
     * Get details
     *
     * @return string
     */
    public function getDetails()
    {
        return $this->details;
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

    /**
     * Add user
     *
     * @param Krevindiou\BagheeraBundle\Entity\User $user
     */
    public function addSharedWith(User $user)
    {
        $this->sharedWith[] = $user;
    }

    /**
     * Get sharedWith
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getSharedWith()
    {
        return $this->sharedWith;
    }

    /**
     * Set bank
     *
     * @param Krevindiou\BagheeraBundle\Entity\Bank $bank
     */
    public function setBank(Bank $bank)
    {
        $this->bank = $bank;
    }

    /**
     * Get bank
     *
     * @return Krevindiou\BagheeraBundle\Entity\Bank
     */
    public function getBank()
    {
        return $this->bank;
    }

    /**
     * Get account transactions
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getTransactions()
    {
        return $this->transactions;
    }

    /**
     * Get account schedulers
     *
     * @return Doctrine\Common\Collections\ArrayCollection
     */
    public function getSchedulers()
    {
        return $this->schedulers;
    }

    /**
     * Get balance
     *
     * @return float
     */
/*
    public function getBalance($reconciledOnly = false)
    {
        $dql = 'SELECT (SUM(t._credit) - SUM(t._debit)) ';
        $dql.= 'FROM Application\\Models\\Transaction t ';
        $dql.= 'WHERE t._account = :account ';
        if ($reconciledOnly) {
            $dql.= 'AND t._isReconciled = 1 ';
        }

        $query = $em->createQuery($dql);
        $query->setParameter('account', $em->find('Application\Models\Account', $this->getAccountId()));
        $balance = $query->getSingleScalarResult();

        return sprintf('%.2f', $this->getInitialBalance() + $balance);
    }
*/
}
