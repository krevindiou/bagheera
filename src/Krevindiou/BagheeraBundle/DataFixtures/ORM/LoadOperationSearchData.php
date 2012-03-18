<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Doctrine\Common\Persistence\ObjectManager,
    Doctrine\Common\Collections\ArrayCollection,
    Krevindiou\BagheeraBundle\Entity\OperationSearch;

class LoadOperationSearchData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        // John - HSBC - Checking account #1
        $operationSearch = new OperationSearch();
        $operationSearch->setAccount($this->getReference('account-checking_account_1'));
        $operationSearch->setThirdParty('Third party 1');
        $em->persist($operationSearch);

        // John - HSBC - Home savings account
        $operationSearch = new OperationSearch();
        $operationSearch->setAccount($this->getReference('account-home_savings_account'));
        $operationSearch->setCategories(new ArrayCollection(array($this->getReference('category-cat21'))));
        $em->persist($operationSearch);

        // Jane - BNP Paribas - Securities account
        $operationSearch = new OperationSearch();
        $operationSearch->setAccount($this->getReference('account-securities_account'));
        $operationSearch->setPaymentMethods(new ArrayCollection(array($this->getReference('paymentmethod-debit-creditcard'))));
        $em->persist($operationSearch);

        $em->flush();
    }

    public function getOrder()
    {
        return 8;
    }
}
