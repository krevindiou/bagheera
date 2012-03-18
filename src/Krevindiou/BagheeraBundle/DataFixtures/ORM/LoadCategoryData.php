<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Doctrine\Common\Persistence\ObjectManager,
    Krevindiou\BagheeraBundle\Entity\Category;

class LoadCategoryData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        $cat1 = new Category();
        $cat1->setType('credit');
        $cat1->setName('Cat 1');
        $cat1->setIsActive(true);
        $em->persist($cat1);
        $this->addReference('category-cat1', $cat1);

        $cat11 = new Category();
        $cat11->setParentCategory($cat1);
        $cat11->setType('credit');
        $cat11->setName('Cat 1.1');
        $cat11->setIsActive(true);
        $em->persist($cat11);
        $this->addReference('category-cat11', $cat11);

        $cat2 = new Category();
        $cat2->setType('debit');
        $cat2->setName('Cat 2');
        $cat2->setIsActive(true);
        $em->persist($cat2);
        $this->addReference('category-cat2', $cat2);

        $cat21 = new Category();
        $cat21->setParentCategory($cat2);
        $cat21->setType('debit');
        $cat21->setName('Cat 2.1');
        $cat21->setIsActive(true);
        $em->persist($cat21);
        $this->addReference('category-cat21', $cat21);

        $cat22 = new Category();
        $cat22->setParentCategory($cat2);
        $cat22->setType('debit');
        $cat22->setName('Cat 2.2');
        $cat22->setIsActive(true);
        $em->persist($cat22);
        $this->addReference('category-cat22', $cat22);

        $em->flush();
    }

    public function getOrder()
    {
        return 2;
    }
}
