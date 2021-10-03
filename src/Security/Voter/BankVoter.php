<?php

declare(strict_types=1);

namespace App\Security\Voter;

use App\Entity\Bank;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;
use Symfony\Component\Security\Core\User\UserInterface;

class BankVoter extends Voter
{
    protected function supports($attribute, $subject): bool
    {
        return in_array($attribute, ['BANK_EDIT', 'BANK_CLOSE', 'BANK_DELETE'], true) && $subject instanceof Bank;
    }

    protected function voteOnAttribute($attribute, $subject, TokenInterface $token): bool
    {
        $connectedMember = $token->getUser();
        if (!$connectedMember instanceof UserInterface) {
            return false;
        }

        if ($subject->getMember() !== $connectedMember) {
            return false;
        }

        switch ($attribute) {
            case 'BANK_EDIT':
            case 'BANK_CLOSE':
                return !$subject->isClosed() && !$subject->isDeleted();
            case 'BANK_DELETE':
                return !$subject->isDeleted();
        }

        return false;
    }
}
