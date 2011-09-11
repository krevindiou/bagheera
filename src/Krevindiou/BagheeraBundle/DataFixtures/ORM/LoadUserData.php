<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Krevindiou\BagheeraBundle\Entity\User;

class LoadUserData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load($em)
    {
        $user = new User();
        $user->setFirstname('John');
        $user->setLastname('DOE');
        $user->setEmail('john@example.net');
        $user->setPassword('a0d540a78cd61daa5fb872ac29272c00');
        $user->setActivation('b4fa77f5180803d0f6f4f504594da09e');
        $user->setIsAdmin(true);
        $user->setIsActive(true);
        $em->persist($user);
        $this->addReference('user-john', $user);

        $user = new User();
        $user->setFirstname('Jane');
        $user->setLastname('DOE');
        $user->setEmail('jane@example.net');
        $user->setPassword('5844a15e76563fedd11840fd6f40ea7b');
        $user->setActivation('a24fe4584a99123d8f38a9a4e0abae54');
        $user->setIsAdmin(false);
        $user->setIsActive(true);
        $em->persist($user);
        $this->addReference('user-jane', $user);

        $em->flush();
    }

    public function getOrder()
    {
        return 3;
    }
}
