<?php

declare(strict_types=1);

namespace App\Security\Voter;

use App\Entity\Member;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;
use Symfony\Component\Security\Core\User\UserInterface;

class MemberVoter extends Voter
{
    protected function supports(string $attribute, $subject): bool
    {
        return in_array($attribute, ['MEMBER_VIEW'], true) && $subject instanceof Member;
    }

    protected function voteOnAttribute(string $attribute, $subject, TokenInterface $token): bool
    {
        /** @var Member $subject */
        $connectedMember = $token->getUser();
        if (!$connectedMember instanceof UserInterface) {
            return false;
        }

        if ($subject !== $connectedMember) {
            return false;
        }

        switch ($attribute) {
            case 'MEMBER_VIEW':
                return $subject->isActive();
        }

        return false;
    }
}
