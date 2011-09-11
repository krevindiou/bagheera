<?php

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture,
    Doctrine\Common\DataFixtures\OrderedFixtureInterface,
    Krevindiou\BagheeraBundle\Entity\Transaction;

class LoadTransactionData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load($em)
    {
        // John - HSBC - Checking account #1
        $transaction1 = new Transaction();
        $transaction1->setAccount($this->getReference('account-checking_account_1'));
        $transaction1->setCategory($this->getReference('category-cat2'));
        $transaction1->setThirdParty('Third party 1');
        $transaction1->setPaymentMethod($this->getReference('paymentmethod-debit-transfer'));
        $transaction1->setDebit(29.16);
        $transaction1->setCredit(null);
        $transaction1->setValueDate(new \DateTime('2011-09-01'));
        $transaction1->setIsReconciled(true);
        $em->persist($transaction1);

        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-checking_account_1'));
        $transaction->setCategory($this->getReference('category-cat21'));
        $transaction->setThirdParty('Third party 2');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $transaction->setDebit(48.69);
        $transaction->setCredit(null);
        $transaction->setValueDate(new \DateTime('2011-09-02'));
        $transaction->setIsReconciled(false);
        $em->persist($transaction);

        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-checking_account_1'));
        $transaction->setCategory($this->getReference('category-cat1'));
        $transaction->setThirdParty('Third party 3');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-credit-check'));
        $transaction->setDebit(null);
        $transaction->setCredit(18.05);
        $transaction->setValueDate(new \DateTime('2011-09-03'));
        $transaction->setIsReconciled(true);
        $em->persist($transaction);

        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-checking_account_1'));
        $transaction->setCategory($this->getReference('category-cat11'));
        $transaction->setThirdParty('Third party 4');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-credit-deposit'));
        $transaction->setDebit(null);
        $transaction->setCredit(38.31);
        $transaction->setValueDate(new \DateTime('2011-09-04'));
        $transaction->setIsReconciled(true);
        $em->persist($transaction);


        // John - HSBC - Home savings account
        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-home_savings_account'));
        $transaction->setCategory($this->getReference('category-cat21'));
        $transaction->setThirdParty('Third party 1');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $transaction->setDebit(24.77);
        $transaction->setCredit(null);
        $transaction->setValueDate(new \DateTime('2011-09-01'));
        $transaction->setIsReconciled(true);
        $em->persist($transaction);

        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-home_savings_account'));
        $transaction->setCategory($this->getReference('category-cat1'));
        $transaction->setThirdParty('Third party 2');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-credit-transfer'));
        $transaction->setDebit(null);
        $transaction->setCredit(29.16);
        $transaction->setValueDate(new \DateTime('2011-09-02'));
        $transaction->setIsReconciled(true);
        $transaction->setTransferTransaction($transaction1);
        $transaction1->setTransferTransaction($transaction);
        $em->persist($transaction);


        // John - Bank of America - Checking account #2
        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-checking_account_2'));
        $transaction->setCategory($this->getReference('category-cat21'));
        $transaction->setThirdParty('Third party 1');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $transaction->setDebit(66.42);
        $transaction->setCredit(null);
        $transaction->setValueDate(new \DateTime('2011-09-01'));
        $transaction->setIsReconciled(true);
        $em->persist($transaction);

        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-checking_account_2'));
        $transaction->setCategory($this->getReference('category-cat1'));
        $transaction->setThirdParty('Third party 2');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-credit-check'));
        $transaction->setDebit(null);
        $transaction->setCredit(71.88);
        $transaction->setValueDate(new \DateTime('2011-09-02'));
        $transaction->setIsReconciled(true);
        $em->persist($transaction);


        // Jane - BNP Paribas - Securities account
        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-securities_account'));
        $transaction->setCategory($this->getReference('category-cat21'));
        $transaction->setThirdParty('Third party 1');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-debit-creditcard'));
        $transaction->setDebit(28.19);
        $transaction->setCredit(null);
        $transaction->setValueDate(new \DateTime('2011-09-01'));
        $transaction->setIsReconciled(true);
        $em->persist($transaction);

        $transaction = new Transaction();
        $transaction->setAccount($this->getReference('account-securities_account'));
        $transaction->setCategory($this->getReference('category-cat1'));
        $transaction->setThirdParty('Third party 2');
        $transaction->setPaymentMethod($this->getReference('paymentmethod-credit-check'));
        $transaction->setDebit(null);
        $transaction->setCredit(0.67);
        $transaction->setValueDate(new \DateTime('2011-09-02'));
        $transaction->setIsReconciled(true);
        $em->persist($transaction);


        $em->flush();
    }

    public function getOrder()
    {
        return 6;
    }
}
