<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping\Column;

trait TimestampableTrait
{
    #[Column(name: 'created_at', type: 'datetime')]
    private \DateTime $createdAt;

    #[Column(name: 'updated_at', type: 'datetime', nullable: true)]
    private \DateTime $updatedAt;

    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }
}
