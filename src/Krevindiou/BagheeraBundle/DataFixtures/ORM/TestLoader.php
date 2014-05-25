<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\Persistence\ObjectManager;
use Hautelook\AliceBundle\Alice\DataFixtureLoader;
use Nelmio\Alice\Fixtures;

class TestLoader extends DataFixtureLoader
{
    /**
     * {@inheritDoc}
     */
    public function load(ObjectManager $manager)
    {
        parent::load($manager);

        // Encrypt passwords
        $members = $this->manager->getRepository('Model:Member')->findAll();
        foreach ($members as $member) {
            $encoder = $this->container->get('security.encoder_factory')->getEncoder($member);
            $member->setPassword($encoder->encodePassword($member->getPassword(), $member->getSalt()));
        }
        $this->manager->flush();
    }

    /**
     * {@inheritDoc}
     */
    protected function getFixtures()
    {
        return  [
            __DIR__ . '/fixtures.yml',
            __DIR__ . '/fixtures_john.yml',
            __DIR__ . '/fixtures_jane.yml',
            __DIR__ . '/fixtures_jack.yml',
        ];
    }
}
