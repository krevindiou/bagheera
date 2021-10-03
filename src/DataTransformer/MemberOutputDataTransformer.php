<?php

declare(strict_types=1);

namespace App\DataTransformer;

use ApiPlatform\Core\DataTransformer\DataTransformerInterface;
use App\Dto\MemberOutput;
use App\Entity\Member;

final class MemberOutputDataTransformer implements DataTransformerInterface
{
    public function transform($data, string $to, array $context = [])
    {
        $output = new MemberOutput();
        $output->memberId = $data->getMemberId();
        $output->email = $data->getEmail();
        $output->country = $data->getCountry();

        return $output;
    }

    public function supportsTransformation($data, string $to, array $context = []): bool
    {
        return MemberOutput::class === $to && $data instanceof Member;
    }
}
