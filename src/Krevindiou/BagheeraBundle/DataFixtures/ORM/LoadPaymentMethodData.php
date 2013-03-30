<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\DataFixtures\ORM;

use Doctrine\Common\DataFixtures\AbstractFixture;
use Doctrine\Common\DataFixtures\OrderedFixtureInterface;
use Doctrine\Common\Persistence\ObjectManager;
use Krevindiou\BagheeraBundle\Entity\PaymentMethod;

class LoadPaymentMethodData extends AbstractFixture implements OrderedFixtureInterface
{
    public function load(ObjectManager $em)
    {
        $paymentMethod = new PaymentMethod();
        $paymentMethod->setName('credit_card');
        $paymentMethod->setType('debit');
        $em->persist($paymentMethod);
        $this->addReference('paymentmethod-debit-creditcard', $paymentMethod);

        $paymentMethod = new PaymentMethod();
        $paymentMethod->setName('check');
        $paymentMethod->setType('debit');
        $em->persist($paymentMethod);
        $this->addReference('paymentmethod-debit-check', $paymentMethod);

        $paymentMethod = new PaymentMethod();
        $paymentMethod->setName('withdrawal');
        $paymentMethod->setType('debit');
        $em->persist($paymentMethod);
        $this->addReference('paymentmethod-debit-withdrawal', $paymentMethod);

        $paymentMethod = new PaymentMethod();
        $paymentMethod->setName('transfer');
        $paymentMethod->setType('debit');
        $em->persist($paymentMethod);
        $this->addReference('paymentmethod-debit-transfer', $paymentMethod);

        $paymentMethod = new PaymentMethod();
        $paymentMethod->setName('check');
        $paymentMethod->setType('credit');
        $em->persist($paymentMethod);
        $this->addReference('paymentmethod-credit-check', $paymentMethod);

        $paymentMethod = new PaymentMethod();
        $paymentMethod->setName('transfer');
        $paymentMethod->setType('credit');
        $em->persist($paymentMethod);
        $this->addReference('paymentmethod-credit-transfer', $paymentMethod);

        $paymentMethod = new PaymentMethod();
        $paymentMethod->setName('deposit');
        $paymentMethod->setType('credit');
        $em->persist($paymentMethod);
        $this->addReference('paymentmethod-credit-deposit', $paymentMethod);

        $em->flush();
    }

    public function getOrder()
    {
        return 1;
    }
}
