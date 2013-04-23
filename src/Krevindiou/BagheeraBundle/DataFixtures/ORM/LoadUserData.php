<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\Common\Persistence\ObjectManager;
use Krevindiou\BagheeraBundle\Entity\User;
use Symfony\Component\Security\Core\Encoder\MessageDigestPasswordEncoder;

class LoadUserData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        $encoder = new MessageDigestPasswordEncoder('sha512', false, 1);

        $user = new User();
        $user->setEmail('john@example.net');
        $user->setPassword($encoder->encodePassword('john', $user->getSalt()));
        $user->setCountry('US');
        $user->setAdmin(false);
        $user->setActive(true);
        $em->persist($user);
        $this->addReference('user-john', $user);

        $user = new User();
        $user->setEmail('jane@example.net');
        $user->setPassword($encoder->encodePassword('jane', $user->getSalt()));
        $user->setCountry('FR');
        $user->setAdmin(true);
        $user->setActive(true);
        $em->persist($user);
        $this->addReference('user-jane', $user);

        $user = new User();
        $user->setEmail('jack@example.net');
        $user->setPassword($encoder->encodePassword('jack', $user->getSalt()));
        $user->setCountry('US');
        $user->setAdmin(false);
        $user->setActive(false);
        $em->persist($user);
        $this->addReference('user-jack', $user);

        $em->flush();
    }

    public function getOrder()
    {
        return 3;
    }
}
