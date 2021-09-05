<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * @ORM\Entity(repositoryClass="App\Repository\SchedulerRepository")
 * @ORM\Table(name="scheduler")
 */
class Scheduler
{
    use OperationTrait;

    /**
     *
     * @ORM\Column(name="scheduler_id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="IDENTITY")
     */
    protected ?int $schedulerId = null;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="limit_date", type="date", nullable=true)
     */
    #[Assert\Type(type: 'DateTime')]
    protected $limitDate;

    /**
     * @ORM\Column(name="frequency_unit", type="string", length=16, options={"default": "month"})
     */
    #[Assert\NotBlank]
    #[Assert\Choice(choices: ['day', 'week', 'month', 'year'])]
    protected ?string $frequencyUnit = 'month';

    /**
     * @ORM\Column(name="frequency_value", type="smallint")
     */
    #[Assert\NotBlank]
    #[Assert\Type(type: 'integer')]
    protected ?int $frequencyValue = null;

    /**
     * @var bool
     *
     * @ORM\Column(name="is_active", type="boolean", options={"default": true})
     */
    #[Assert\Type(type: 'bool')]
    protected $active = true;

    public function setSchedulerId(?int $schedulerId): void
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
