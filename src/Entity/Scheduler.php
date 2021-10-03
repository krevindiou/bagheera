<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\ManyToOne;
use Doctrine\ORM\Mapping\Table;
use Symfony\Component\Validator\Constraints as Assert;

#[Entity]
#[Table(name: 'scheduler')]
class Scheduler
{
    use OperationTrait;

    #[Assert\NotNull]
    #[Assert\Type(type: Account::class)]
    #[ManyToOne(targetEntity: Account::class, inversedBy: 'schedulers')]
    #[JoinColumn(name: 'account_id', referencedColumnName: 'account_id', nullable: false)]
    private Account $account;

    #[Id, Column(name: 'scheduler_id', type: 'integer')]
    #[GeneratedValue(strategy: 'IDENTITY')]
    private ?int $schedulerId = null;

    #[Assert\Type(type: \DateTime::class)]
    #[Column(name: 'limit_date', type: 'date', nullable: true)]
    private ?\DateTime $limitDate = null;

    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['day', 'week', 'month', 'year'])]
    #[Column(name: 'frequency_unit', type: 'string', length: 16, options: ['default' => 'month'])]
    private ?string $frequencyUnit = 'month';

    #[Assert\NotBlank]
    #[Assert\Type(type: 'integer')]
    #[Column(name: 'frequency_value', type: 'smallint')]
    private ?int $frequencyValue = null;

    #[Assert\Type(type: 'bool')]
    #[Column(name: 'is_active', type: 'boolean', options: ['default' => true])]
    private ?bool $active = true;

    public function setSchedulerId(int $schedulerId): void
    {
        $this->schedulerId = $schedulerId;
    }

    public function getSchedulerId(): ?int
    {
        return $this->schedulerId;
    }

    public function getAmount(): ?int
    {
        return (null !== $this->credit) ? $this->credit : -$this->debit;
    }

    public function setLimitDate(?\DateTime $limitDate): void
    {
        $this->limitDate = $limitDate;
    }

    public function getLimitDate(): ?\DateTime
    {
        return $this->limitDate;
    }

    public function setFrequencyUnit(string $frequencyUnit): void
    {
        $this->frequencyUnit = $frequencyUnit;
    }

    public function getFrequencyUnit(): ?string
    {
        return $this->frequencyUnit;
    }

    public function setFrequencyValue(int $frequencyValue): void
    {
        $this->frequencyValue = $frequencyValue;
    }

    public function getFrequencyValue(): ?int
    {
        return $this->frequencyValue;
    }

    public function setActive(bool $active): void
    {
        $this->active = $active;
    }

    public function isActive(): ?bool
    {
        return $this->active;
    }

    public function isOwner(Member $member): bool
    {
        return $this->getAccount()->getBank()->getMember()->getMemberId() === $member->getMemberId();
    }
}
