<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Doctrine\Common\Persistence\ObjectManager,
    Krevindiou\BagheeraBundle\Entity\Scheduler;

class LoadSchedulerData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        /**
         * John - HSBC - Checking account
         */
        $scheduler = new Scheduler();
        $scheduler->setAccount($this->getReference('account-hsbc-checking_account'));
        $scheduler->setCategory($this->getReference('category-cat2'));
        $scheduler->setThirdParty('Third party 1');
        $scheduler->setDebit(29.16);
        $scheduler->setCredit(null);
        $scheduler->setValueDate(new \DateTime('2011-08-04'));
        $scheduler->setLimitDate(null);
        $scheduler->setIsReconciled(false);
        $scheduler->setNotes('');
        $scheduler->setFrequencyUnit('week');
        $scheduler->setFrequencyValue(2);
        $scheduler->setIsActive(true);
        $scheduler->setTransferAccount($this->getReference('account-hsbc-certificate_of_deposit_1'));
        $scheduler->setPaymentMethod($this->getReference('paymentmethod-debit-transfer'));
        $em->persist($scheduler);
        $this->addReference('scheduler-john-1', $scheduler);

        $scheduler = new Scheduler();
        $scheduler->setAccount($this->getReference('account-hsbc-checking_account'));
        $scheduler->setCategory($this->getReference('category-cat2'));
        $scheduler->setThirdParty('Third party future scheduler');
        $scheduler->setDebit(1);
        $scheduler->setCredit(null);
        $scheduler->setValueDate(new \DateTime('next year'));
        $scheduler->setLimitDate(null);
        $scheduler->setIsReconciled(false);
        $scheduler->setNotes('');
        $scheduler->setFrequencyUnit('week');
        $scheduler->setFrequencyValue(2);
        $scheduler->setIsActive(true);
        $scheduler->setTransferAccount($this->getReference('account-hsbc-certificate_of_deposit_1'));
        $scheduler->setPaymentMethod($this->getReference('paymentmethod-debit-transfer'));
        $em->persist($scheduler);

        /**
         * Jane - BNP Paribas - Checking account
         */
        $scheduler = new Scheduler();
        $scheduler->setAccount($this->getReference('account-bnp_paribas-checking_account'));
        $scheduler->setCategory($this->getReference('category-cat21'));
        $scheduler->setThirdParty('Third party 1');
        $scheduler->setDebit(28.19);
        $scheduler->setCredit(null);
        $scheduler->setValueDate(new \DateTime('2011-09-01'));
        $scheduler->setLimitDate(null);
        $scheduler->setIsReconciled(false);
        $scheduler->setNotes('');
        $scheduler->setFrequencyUnit('month');
        $scheduler->setFrequencyValue(1);
        $scheduler->setIsActive(true);
        $scheduler->setTransferAccount(null);
        $scheduler->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $em->persist($scheduler);
        $this->addReference('scheduler-jane-1', $scheduler);

        $em->flush();
    }

    public function getOrder()
    {
        return 6;
    }
}
