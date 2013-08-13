<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\Common\Persistence\ObjectManager;
use Krevindiou\BagheeraBundle\Entity\Member;
use Symfony\Component\Security\Core\Encoder\MessageDigestPasswordEncoder;

class LoadMemberData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        $encoder = new MessageDigestPasswordEncoder('sha512', false, 1);

        $member = new Member();
        $member->setEmail('john@example.net');
        $member->setPassword($encoder->encodePassword('john', $member->getSalt()));
        $member->setCountry('US');
        $member->setAdmin(false);
        $member->setActive(true);
        $em->persist($member);
        $this->addReference('member-john', $member);

        $member = new Member();
        $member->setEmail('jane@example.net');
        $member->setPassword($encoder->encodePassword('jane', $member->getSalt()));
        $member->setCountry('FR');
        $member->setAdmin(true);
        $member->setActive(true);
        $em->persist($member);
        $this->addReference('member-jane', $member);

        $member = new Member();
        $member->setEmail('jack@example.net');
        $member->setPassword($encoder->encodePassword('jack', $member->getSalt()));
        $member->setCountry('US');
        $member->setAdmin(false);
        $member->setActive(false);
        $em->persist($member);
        $this->addReference('member-jack', $member);

        $em->flush();
    }

    public function getOrder()
    {
        return 3;
    }
}
