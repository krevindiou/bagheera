<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Bank;
use App\Entity\BankAccess;
use App\Entity\Member;
use App\Form\Model\BankAccessFormModel;
use App\Form\Type\BankAccessFormType;
use App\Repository\BankAccessRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class BankAccessService
{
    public function __construct(private string $secret, private LoggerInterface $logger, private EntityManagerInterface $entityManager, private EntityManagerInterface $secureEntityManager, private FormFactoryInterface $formFactory, private ValidatorInterface $validator, private BankService $bankService, private CryptService $cryptService)
    {
    }

    /**
     * Returns bank access form.
     */
    public function getForm(Member $member, Bank $bank): ?FormInterface
    {
        if ($member !== $bank->getMember() || null === $bank->getProvider()) {
            return null;
        }

        $formModel = new BankAccessFormModel();
        $formModel->bank = $bank;

        return $this->formFactory->create(BankAccessFormType::class, $formModel);
    }

    /**
     * Saves bank access form.
     */
    public function saveForm(Member $member, FormInterface $form): bool
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
        $bank = $this->entityManager->find(Bank::class, $bankAccess->getBankId());

        if (null !== $bank && $member === $bank->getMember()) {
            try {
                // Delete previous access data
                /** @var BankAccessRepository */
                $bankAccessRepository = $this->secureEntityManager->getRepository(BankAccess::class);
                $bankAccessRepository->delete($bankAccess);

                $encryptedLogin = $this->cryptService->encrypt($bankAccess->getPlainLogin(), $this->secret);
                $encryptedPassword = $this->cryptService->encrypt($bankAccess->getPlainPassword(), $this->secret);

                $bankAccess->setLogin($encryptedLogin);
                $bankAccess->setPassword($encryptedPassword);
                $bankAccess->setPlainLogin('');
                $bankAccess->setPlainPassword('');

                $this->secureEntityManager->persist($bankAccess);
                $this->secureEntityManager->flush();

                $this->bankService->importExternalBank($bank);

                return true;
            } catch (\Exception $e) {
                $this->logger->error($e->getMessage());
            }
        }

        return false;
    }
}
