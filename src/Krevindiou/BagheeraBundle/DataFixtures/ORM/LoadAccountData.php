<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\Common\Persistence\ObjectManager;
use Krevindiou\BagheeraBundle\Entity\Account;

class LoadAccountData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        /**
         * John - HSBC
         */
        $account = new Account();
        $account->setBank($this->getReference('bank-john-hsbc'));
        $account->setName('John - HSBC - Checking account');
        $account->setCurrency('USD');
        $account->setOverdraftFacility(100);
        $account->setIsDeleted(false);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-hsbc-checking_account', $account);

        $account = new Account();
        $account->setBank($this->getReference('bank-john-hsbc'));
        $account->setName('John - HSBC - Certificate of deposit #1');
        $account->setCurrency('USD');
        $account->setOverdraftFacility(0);
        $account->setIsDeleted(false);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-hsbc-certificate_of_deposit_1', $account);

        $account = new Account();
        $account->setBank($this->getReference('bank-john-hsbc'));
        $account->setName('John - HSBC - Certificate of deposit #2');
        $account->setCurrency('EUR');
        $account->setOverdraftFacility(0);
        $account->setIsDeleted(false);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-hsbc-certificate_of_deposit_2', $account);

        $account = new Account();
        $account->setBank($this->getReference('bank-john-hsbc'));
        $account->setName('John - HSBC - Certificate of deposit #3');
        $account->setCurrency('USD');
        $account->setOverdraftFacility(0);
        $account->setIsDeleted(true);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-hsbc-certificate_of_deposit_3', $account);

        /**
         * John - Bank of America
         */
        $account = new Account();
        $account->setBank($this->getReference('bank-john-bank_of_america'));
        $account->setName('John - Bank of America - Checking account');
        $account->setCurrency('USD');
        $account->setOverdraftFacility(0);
        $account->setIsDeleted(false);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-bank_of_america-checking_account', $account);

        /**
         * John - Wells Fargo
         */
        $account = new Account();
        $account->setBank($this->getReference('bank-john-wells_fargo'));
        $account->setName('John - Wells Fargo - Checking account');
        $account->setCurrency('USD');
        $account->setOverdraftFacility(0);
        $account->setIsDeleted(false);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-wells_fargo-checking_account', $account);

        /**
         * John - Santander
         */
        $account = new Account();
        $account->setBank($this->getReference('bank-john-santander'));
        $account->setName('John - Santander - Checking account');
        $account->setCurrency('USD');
        $account->setOverdraftFacility(0);
        $account->setIsDeleted(false);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-santander-checking_account', $account);

        /**
         * Jane - BNP Paribas
         */
        $account = new Account();
        $account->setBank($this->getReference('bank-jane-bnp_paribas'));
        $account->setName('Jane - BNP Paribas - Checking account');
        $account->setCurrency('EUR');
        $account->setOverdraftFacility(0);
        $account->setIsDeleted(false);
        $account->setCreatedAt(new \DateTime('2011-08-31'));
        $em->persist($account);
        $this->addReference('account-bnp_paribas-checking_account', $account);

        $em->flush();
    }

    public function getOrder()
    {
        return 5;
    }
}
