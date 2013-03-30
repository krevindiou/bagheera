<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\Common\Persistence\ObjectManager;
use Krevindiou\BagheeraBundle\Entity\Bank;

class LoadBankData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        /**
         * John
         */
        $bank = new Bank();
        $bank->setUser($this->getReference('user-john'));
        $bank->setProvider(null);
        $bank->setName('HSBC');
        $bank->setSortOrder(1);
        $bank->setIsFavorite(false);
        $bank->setIsClosed(false);
        $bank->setIsDeleted(false);
        $em->persist($bank);
        $this->addReference('bank-john-hsbc', $bank);

        $bank = new Bank();
        $bank->setUser($this->getReference('user-john'));
        $bank->setProvider(null);
        $bank->setName('Bank of America');
        $bank->setSortOrder(2);
        $bank->setIsFavorite(true);
        $bank->setIsClosed(false);
        $bank->setIsDeleted(false);
        $em->persist($bank);
        $this->addReference('bank-john-bank_of_america', $bank);

        $bank = new Bank();
        $bank->setUser($this->getReference('user-john'));
        $bank->setProvider(null);
        $bank->setName('Wells Fargo');
        $bank->setSortOrder(3);
        $bank->setIsFavorite(false);
        $bank->setIsClosed(true);
        $bank->setIsDeleted(false);
        $em->persist($bank);
        $this->addReference('bank-john-wells_fargo', $bank);

        $bank = new Bank();
        $bank->setUser($this->getReference('user-john'));
        $bank->setProvider(null);
        $bank->setName('Santander');
        $bank->setSortOrder(4);
        $bank->setIsFavorite(false);
        $bank->setIsClosed(false);
        $bank->setIsDeleted(true);
        $em->persist($bank);
        $this->addReference('bank-john-santander', $bank);

        /**
         * Jane
         */
        $bank = new Bank();
        $bank->setUser($this->getReference('user-jane'));
        $bank->setProvider(null);
        $bank->setName('BNP Paribas');
        $bank->setSortOrder(1);
        $bank->setIsFavorite(false);
        $bank->setIsClosed(false);
        $bank->setIsDeleted(false);
        $em->persist($bank);
        $this->addReference('bank-jane-bnp_paribas', $bank);

        $em->flush();
    }

    public function getOrder()
    {
        return 4;
    }
}
