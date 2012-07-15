<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Doctrine\Common\Persistence\ObjectManager,
    Krevindiou\BagheeraBundle\Entity\Bank;

class LoadBankData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        $bank = new Bank();
        $bank->setUser($this->getReference('user-john'));
        $bank->setName('HSBC');
        $em->persist($bank);
        $this->addReference('bank-hsbc', $bank);

        $bank = new Bank();
        $bank->setUser($this->getReference('user-john'));
        $bank->setName('Bank of America');
        $em->persist($bank);
        $this->addReference('bank-bank_of_america', $bank);

        $bank = new Bank();
        $bank->setUser($this->getReference('user-jane'));
        $bank->setName('BNP Paribas');
        $em->persist($bank);
        $this->addReference('bank-bnp_paribas', $bank);

        $em->flush();
    }

    public function getOrder()
    {
        return 4;
    }
}
