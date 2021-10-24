<?php

declare(strict_types=1);

namespace App\DataTransformer;

use ApiPlatform\Core\DataTransformer\DataTransformerInterface;
use ApiPlatform\Core\Validator\ValidatorInterface;
use App\Entity\Member;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoderInterface;

final class MemberInputDataTransformer implements DataTransformerInterface
{
    public function __construct(
        private ValidatorInterface $validator,
        private UserPasswordEncoderInterface $passwordEncoder
    ) {
    }

    public function transform($data, string $to, array $context = []): Member
    {
        $this->validator->validate($data);

        $member = new Member();
        $member->setEmail($data->email);
        $member->setCountry($data->country);
        $member->setPassword($this->passwordEncoder->encodePassword($member, $data->plainPassword));

        return $member;
    }

    public function supportsTransformation($data, string $to, array $context = []): bool
    {
        if ($data instanceof Member) {
            return false;
        }

        return Member::class === $to && null !== ($context['input']['class'] ?? null);
    }
}
