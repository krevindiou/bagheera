<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\Validator\Validator;
use Symfony\Bridge\Monolog\Logger;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Entity\User;
use Krevindiou\BagheeraBundle\Entity\Bank;
use Krevindiou\BagheeraBundle\Entity\BankAccess;
use Krevindiou\BagheeraBundle\Form\BankAccessForm;

/**
 * @DI\Service("bagheera.bank_access")
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

    /** @DI\Inject("bagheera.bank") */
    public $bankService;

    /** @DI\Inject("bagheera.crypt") */
    public $cryptService;

    /**
     * Returns bank access form
     *
     * @param  User $user User entity
     * @param  Bank $bank Bank entity
     * @return Form
     */
    public function getForm(User $user, Bank $bank)
    {
        if ($user !== $bank->getUser() || null === $bank->getProvider()) {
            return;
        }

        $bankAccess = new BankAccess();
        $bankAccess->setBankId($bank->getBankId());

        return $this->formFactory->create(new BankAccessForm(), $bankAccess);
    }

    /**
     * Saves bank access
     *
     * @param  User       $user       User entity
     * @param  BankAccess $bankAccess BankAccess entity
     * @return boolean
     */
    protected function doSave(User $user, BankAccess $bankAccess)
    {
        $bank = $this->em->find('KrevindiouBagheeraBundle:Bank', $bankAccess->getBankId());

        if (null !== $bank && $user === $bank->getUser()) {
            try {
                // Delete previous access data
                $dql = 'DELETE FROM KrevindiouBagheeraBundle:BankAccess b ';
                $dql.= 'WHERE b.bankId = :bankId ';

                $this->emSecure->createQuery($dql)
                    ->setParameter('bankId', $bankAccess->getBankId())
                    ->execute();

                $encryptedLogin = $this->cryptService->crypt(array($bankAccess->getPlainLogin()));
                $encryptedPassword = $this->cryptService->crypt(array($bankAccess->getPlainPassword()));

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
     * Saves bank access
     *
     * @param  User       $user       User entity
     * @param  BankAccess $bankAccess BankAccess entity
     * @return boolean
     */
    public function save(User $user, BankAccess $bankAccess)
    {
        $errors = $this->validator->validate($bankAccess);

        if (0 == count($errors)) {
            return $this->save($user, $bankAccess);
        }

        return false;
    }

    /**
     * Saves bank access form
     *
     * @param  User    $user User entity
     * @param  Form    $form BankAccess form
     * @return boolean
     */
    public function saveForm(User $user, Form $form)
    {
        if ($form->isValid()) {
            return $this->doSave($user, $form->getData());
        }

        return false;
    }
}
