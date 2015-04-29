<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Service;

use Symfony\Component\Form\Form;
use JMS\DiExtraBundle\Annotation as DI;
use AppBundle\Entity\Member;
use AppBundle\Entity\Bank;
use AppBundle\Entity\BankAccess;

/**
 * @DI\Service("app.bank_access")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "bank_access"})
 */
class BankAccessService
{
    /** @DI\Inject("%secret%") */
    public $secret;

    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /** @DI\Inject("doctrine.orm.secure_entity_manager") */
    public $emSecure;

    /** @DI\Inject("form.factory") */
    public $formFactory;

    /** @DI\Inject */
    public $validator;

    /** @DI\Inject("app.bank") */
    public $bankService;

    /** @DI\Inject("app.crypt") */
    public $cryptService;

    /**
     * Returns bank access form.
     *
     * @param Member $member Member entity
     * @param Bank   $bank   Bank entity
     *
     * @return Form
     */
    public function getForm(Member $member, Bank $bank)
    {
        if ($member !== $bank->getMember() || null === $bank->getProvider()) {
            return;
        }

        $bankAccess = new BankAccess();
        $bankAccess->setBankId($bank->getBankId());

        return $this->formFactory->create('bank_access', $bankAccess);
    }

    /**
     * Saves bank access.
     *
     * @param Member     $member     Member entity
     * @param BankAccess $bankAccess BankAccess entity
     *
     * @return bool
     */
    protected function doSave(Member $member, BankAccess $bankAccess)
    {
        $bank = $this->em->find('Model:Bank', $bankAccess->getBankId());

        if (null !== $bank && $member === $bank->getMember()) {
            try {
                // Delete previous access data
                $dql = 'DELETE FROM Model:BankAccess b ';
                $dql .= 'WHERE b.bankId = :bankId ';

                $this->emSecure->createQuery($dql)
                    ->setParameter('bankId', $bankAccess->getBankId())
                    ->execute();

                $encryptedLogin = $this->cryptService->crypt([$bankAccess->getPlainLogin()]);
                $encryptedPassword = $this->cryptService->crypt([$bankAccess->getPlainPassword()]);

                $bankAccess->setLogin($encryptedLogin);
                $bankAccess->setPassword($encryptedPassword);
                $bankAccess->setPlainLogin('');
                $bankAccess->setPlainPassword('');

                $this->emSecure->persist($bankAccess);
                $this->emSecure->flush();

                $this->bankService->importExternalBank($bank);

                return true;
            } catch (\Exception $e) {
                $this->logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Saves bank access.
     *
     * @param Member     $member     Member entity
     * @param BankAccess $bankAccess BankAccess entity
     *
     * @return bool
     */
    public function save(Member $member, BankAccess $bankAccess)
    {
        $errors = $this->validator->validate($bankAccess);

        if (0 == count($errors)) {
            return $this->save($member, $bankAccess);
        }

        return false;
    }

    /**
     * Saves bank access form.
     *
     * @param Member $member Member entity
     * @param Form   $form   BankAccess form
     *
     * @return bool
     */
    public function saveForm(Member $member, Form $form)
    {
        if ($form->isValid()) {
            return $this->doSave($member, $form->getData());
        }

        return false;
    }
}
