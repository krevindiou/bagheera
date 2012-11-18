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
        /**
         * John - HSBC - Checking account
         */
        $operationSearch = new OperationSearch();
        $operationSearch->setAccount($this->getReference('account-hsbc-checking_account'));
        $operationSearch->setThirdParty('Third party 1');
        $em->persist($operationSearch);

        /**
         * John - HSBC - Certificate of deposit #1
         */
        $operationSearch = new OperationSearch();
        $operationSearch->setAccount($this->getReference('account-hsbc-certificate_of_deposit_1'));
        $operationSearch->setCategories(new ArrayCollection(array($this->getReference('category-cat21'))));
        $em->persist($operationSearch);

        /**
         * Jane - BNP Paribas - Checking account
         */
        $operationSearch = new OperationSearch();
        $operationSearch->setAccount($this->getReference('account-bnp_paribas-checking_account'));
        $operationSearch->setPaymentMethods(new ArrayCollection(array($this->getReference('paymentmethod-debit-creditcard'))));
        $em->persist($operationSearch);

        $em->flush();
    }

    public function getOrder()
    {
        return 8;
    }
}
