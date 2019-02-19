<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Bank;
use App\Entity\BankAccess;
use App\Entity\Member;
use App\Form\Type\BankAccessFormType;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\Form;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class BankAccessService
{
    private $secret;
    private $logger;
    private $em;
    private $emSecure;
    private $formFactory;
    private $validator;
    private $bankService;
    private $cryptService;

    public function __construct(
        $secret,
        LoggerInterface $logger,
        EntityManagerInterface $em,
        EntityManagerInterface $emSecure,
        FormFactoryInterface $formFactory,
        ValidatorInterface $validator,
        BankService $bankService,
        CryptService $cryptService
    ) {
        $this->secret = $secret;
        $this->logger = $logger;
        $this->em = $em;
        $this->emSecure = $emSecure;
        $this->formFactory = $formFactory;
        $this->validator = $validator;
        $this->bankService = $bankService;
        $this->cryptService = $cryptService;
    }

    /**
     * Returns bank access form.
     */
    public function getForm(Member $member, Bank $bank): ?Form
    {
        if ($member !== $bank->getMember() || null === $bank->getProvider()) {
            return null;
        }

        $bankAccess = new BankAccess();
        $bankAccess->setBankId($bank->getBankId());

        return $this->formFactory->create(BankAccessFormType::class, $bankAccess);
    }

    /**
     * Saves bank access.
     */
    public function save(Member $member, BankAccess $bankAccess): bool
    {
        $errors = $this->validator->validate($bankAccess);

        if (0 === count($errors)) {
            return $this->save($member, $bankAccess);
        }

        return false;
    }

    /**
     * Saves bank access form.
     */
    public function saveForm(Member $member, Form $form): bool
    {
        if ($form->isValid()) {
            return $this->doSave($member, $form->getData());
        }

        return false;
    }

    /**
     * Saves bank access.
     */
    protected function doSave(Member $member, BankAccess $bankAccess): bool
    {
        $bank = $this->em->find('App:Bank', $bankAccess->getBankId());

        if (null !== $bank && $member === $bank->getMember()) {
            try {
                // Delete previous access data
                $this->em->getRepository('App:BankAccess', 'secure')->delete($bankAccess);

                $encryptedLogin = $this->cryptService->encrypt($bankAccess->getPlainLogin(), $this->secret);
                $encryptedPassword = $this->cryptService->encrypt($bankAccess->getPlainPassword(), $this->secret);

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
}
