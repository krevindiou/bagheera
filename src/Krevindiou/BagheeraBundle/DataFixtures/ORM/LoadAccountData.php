<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Doctrine\Common\Persistence\ObjectManager,
    Krevindiou\BagheeraBundle\Entity\Account;

class LoadAccountData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        $account = new Account();
        $account->setBank($this->getReference('bank-hsbc'));
        $account->setName('Checking account #1');
        $account->setInitialBalance(123.56);
        $account->setOverdraftFacility(0);
        $account->setDetails('');
        $em->persist($account);
        $this->addReference('account-checking_account_1', $account);

        $account = new Account();
        $account->setBank($this->getReference('bank-hsbc'));
        $account->setName('Home savings account');
        $account->setInitialBalance(99);
        $account->setOverdraftFacility(0);
        $account->setDetails('');
        $em->persist($account);
        $this->addReference('account-home_savings_account', $account);

        $account = new Account();
        $account->setBank($this->getReference('bank-bank_of_america'));
        $account->setName('Checking account #2');
        $account->setInitialBalance(0);
        $account->setOverdraftFacility(0);
        $account->setDetails('');
        $em->persist($account);
        $this->addReference('account-checking_account_2', $account);

        $account = new Account();
        $account->setBank($this->getReference('bank-bnp_paribas'));
        $account->setName('Securities account');
        $account->setInitialBalance(0);
        $account->setOverdraftFacility(0);
        $account->setDetails('');
        $em->persist($account);
        $this->addReference('account-securities_account', $account);

        $em->flush();
    }

    public function getOrder()
    {
        return 5;
    }
}
