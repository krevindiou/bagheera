<?php

declare(strict_types=1);

namespace App\Form\DataTransformer;

use Symfony\Component\Form\DataTransformerInterface;

class MoneyTransformer implements DataTransformerInterface
{
    public function transform($originalValue)
    {
        if (null === $originalValue) {
            return null;
        }

        return $originalValue / 10000;
    }

    public function reverseTransform($transformedValue)
    {
        if (null === $transformedValue) {
            return;
        }

        return (int) round($transformedValue * 10000);
    }
}
