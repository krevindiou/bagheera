<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Doctrine\Common\Persistence\ObjectManager,
    Krevindiou\BagheeraBundle\Entity\User,
    Symfony\Component\Security\Core\Encoder\MessageDigestPasswordEncoder;

class LoadUserData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        $encoder = new MessageDigestPasswordEncoder('sha512', false, 1);

        $user = new User();
        $user->setEmail('john@example.net');
        $user->setPassword($encoder->encodePassword('john', $user->getSalt()));
        $user->setActivation('b4fa77f5180803d0f6f4f504594da09e');
        $user->setIsAdmin(true);
        $user->setIsActive(true);
        $em->persist($user);
        $this->addReference('user-john', $user);

        $user = new User();
        $user->setEmail('jane@example.net');
        $user->setPassword($encoder->encodePassword('jane', $user->getSalt()));
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
