<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Doctrine\Common\Persistence\ObjectManager,
    Krevindiou\BagheeraBundle\Entity\Operation;

class LoadOperationData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        // John - HSBC - Checking account #1
        $operation1 = new Operation();
        $operation1->setAccount($this->getReference('account-checking_account_1'));
        $operation1->setCategory($this->getReference('category-cat2'));
        $operation1->setThirdParty('Third party 1');
        $operation1->setPaymentMethod($this->getReference('paymentmethod-debit-transfer'));
        $operation1->setDebit(29.16);
        $operation1->setCredit(null);
        $operation1->setValueDate(new \DateTime('2011-09-01'));
        $operation1->setIsReconciled(true);
        $operation1->setScheduler($this->getReference('scheduler-john-1'));
        $em->persist($operation1);

        $operation = new Operation();
        $operation->setAccount($this->getReference('account-checking_account_1'));
        $operation->setCategory($this->getReference('category-cat21'));
        $operation->setThirdParty('Third party 2');
        $operation->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $operation->setDebit(48.69);
        $operation->setCredit(null);
        $operation->setValueDate(new \DateTime('2011-09-02'));
        $operation->setIsReconciled(false);
        $em->persist($operation);

        $operation = new Operation();
        $operation->setAccount($this->getReference('account-checking_account_1'));
        $operation->setCategory($this->getReference('category-cat1'));
        $operation->setThirdParty('Third party 3');
        $operation->setPaymentMethod($this->getReference('paymentmethod-credit-check'));
        $operation->setDebit(null);
        $operation->setCredit(18.05);
        $operation->setValueDate(new \DateTime('2011-09-03'));
        $operation->setIsReconciled(true);
        $em->persist($operation);

        $operation = new Operation();
        $operation->setAccount($this->getReference('account-checking_account_1'));
        $operation->setCategory($this->getReference('category-cat11'));
        $operation->setThirdParty('Third party 4');
        $operation->setPaymentMethod($this->getReference('paymentmethod-credit-deposit'));
        $operation->setDebit(null);
        $operation->setCredit(38.31);
        $operation->setValueDate(new \DateTime('2011-09-04'));
        $operation->setIsReconciled(true);
        $em->persist($operation);

        // John - HSBC - Home savings account
        $operation = new Operation();
        $operation->setAccount($this->getReference('account-home_savings_account'));
        $operation->setCategory($this->getReference('category-cat21'));
        $operation->setThirdParty('Third party 1');
        $operation->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $operation->setDebit(24.77);
        $operation->setCredit(null);
        $operation->setValueDate(new \DateTime('2011-09-01'));
        $operation->setIsReconciled(true);
        $em->persist($operation);

        $operation = new Operation();
        $operation->setAccount($this->getReference('account-home_savings_account'));
        $operation->setCategory($this->getReference('category-cat1'));
        $operation->setThirdParty('Third party 2');
        $operation->setPaymentMethod($this->getReference('paymentmethod-credit-transfer'));
        $operation->setDebit(null);
        $operation->setCredit(29.16);
        $operation->setValueDate(new \DateTime('2011-09-02'));
        $operation->setIsReconciled(true);
        $operation->setTransferOperation($operation1);
        $operation1->setTransferOperation($operation);
        $em->persist($operation);

        // John - Bank of America - Checking account #2
        $operation = new Operation();
        $operation->setAccount($this->getReference('account-checking_account_2'));
        $operation->setCategory($this->getReference('category-cat21'));
        $operation->setThirdParty('Third party 1');
        $operation->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $operation->setDebit(66.42);
        $operation->setCredit(null);
        $operation->setValueDate(new \DateTime('2011-09-01'));
        $operation->setIsReconciled(true);
        $em->persist($operation);

        $operation = new Operation();
        $operation->setAccount($this->getReference('account-checking_account_2'));
        $operation->setCategory($this->getReference('category-cat1'));
        $operation->setThirdParty('Third party 2');
        $operation->setPaymentMethod($this->getReference('paymentmethod-credit-check'));
        $operation->setDebit(null);
        $operation->setCredit(71.88);
        $operation->setValueDate(new \DateTime('2011-09-02'));
        $operation->setIsReconciled(true);
        $em->persist($operation);

        // Jane - BNP Paribas - Securities account
        $operation = new Operation();
        $operation->setAccount($this->getReference('account-securities_account'));
        $operation->setCategory($this->getReference('category-cat21'));
        $operation->setThirdParty('Third party 1');
        $operation->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $operation->setDebit(28.19);
        $operation->setCredit(null);
        $operation->setValueDate(new \DateTime('2011-09-01'));
        $operation->setIsReconciled(true);
        $operation->setScheduler($this->getReference('scheduler-jane-1'));
        $em->persist($operation);

        $operation = new Operation();
        $operation->setAccount($this->getReference('account-securities_account'));
        $operation->setCategory($this->getReference('category-cat1'));
        $operation->setThirdParty('Third party 2');
        $operation->setPaymentMethod($this->getReference('paymentmethod-credit-check'));
        $operation->setDebit(null);
        $operation->setCredit(0.67);
        $operation->setValueDate(new \DateTime('2011-09-02'));
        $operation->setIsReconciled(true);
        $em->persist($operation);

        $em->flush();
    }

    public function getOrder()
    {
        return 7;
    }
}
