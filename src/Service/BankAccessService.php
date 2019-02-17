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

        return $this->formFactory->create(BankAccessFormType::class, $bankAccess);
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

        if (0 === count($errors)) {
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
        $bank = $this->em->find('App:Bank', $bankAccess->getBankId());

        if (null !== $bank && $member === $bank->getMember()) {
            try {
                // Delete previous access data
                $dql = 'DELETE FROM App:BankAccess b ';
                $dql .= 'WHERE b.bankId = :bankId ';

                $this->emSecure->createQuery($dql)
                    ->setParameter('bankId', $bankAccess->getBankId())
                    ->execute()
                ;

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