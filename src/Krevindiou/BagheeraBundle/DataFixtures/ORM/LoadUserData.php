<?php

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
        $user->setActivation('b4fa77f5180803d0f6f4f504594da09e');
        $user->setCountry('US');
        $user->setIsAdmin(false);
        $user->setIsActive(true);
        $em->persist($user);
        $this->addReference('user-john', $user);

        $user = new User();
        $user->setEmail('jane@example.net');
        $user->setPassword($encoder->encodePassword('jane', $user->getSalt()));
        $user->setActivation('a24fe4584a99123d8f38a9a4e0abae54');
        $user->setCountry('FR');
        $user->setIsAdmin(true);
        $user->setIsActive(true);
        $em->persist($user);
        $this->addReference('user-jane', $user);

        $user = new User();
        $user->setEmail('jack@example.net');
        $user->setPassword($encoder->encodePassword('jack', $user->getSalt()));
        $user->setActivation('c5c0d545caa2fc368922382fd7eeb150');
        $user->setCountry('US');
        $user->setIsAdmin(false);
        $user->setIsActive(false);
        $em->persist($user);
        $this->addReference('user-jack', $user);

        $em->flush();
    }

    public function getOrder()
    {
        return 3;
    }
}
