<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\AccountImport;
use App\Repository\AccountImportRepository;
use Doctrine\ORM\EntityManagerInterface;

class AccountImportService
{
    public function __construct(private EntityManagerInterface $entityManager, private AccountImportRepository $accountImportRepository)
    {
    }

    /**
     * Returns current import.
     */
    public function getCurrentImport(Account $account): ?AccountImport
    {
        return $this->accountImportRepository->findOneByAccount($account);
    }

    /**
     * Init import progress data.
     */
    public function initImport(Account $account): void
    {
        $accountImport = $this->getCurrentImport($account);

        if (null === $accountImport) {
            $importId = $this->getNextImportId($account);

            $accountImport = new AccountImport();
            $accountImport->setImportId($importId);
            $accountImport->setAccount($account);
            $this->entityManager->persist($accountImport);
            $this->entityManager->flush();
        }
    }

    /**
     * Updates import progress data.
     */
    public function updateImport(Account $account, int $progress): void
    {
        $accountImport = $this->getCurrentImport($account);

        if (null !== $accountImport) {
            $accountImport->setProgress($progress);

            $this->entityManager->flush();
        }
    }

    /**
     * Closes import progress data.
     */
    public function closeImport(Account $account): void
    {
        $accountImport = $this->getCurrentImport($account);

        if (null !== $accountImport) {
            $accountImport->setFinished(true);

            $this->entityManager->flush();
        }
    }

    /**
     * Saves transactions data depending on type.
     */
    public function setData(Account $account, string $data, string $type): void
    {
        $accountImport = $this->getCurrentImport($account);

        if (null !== $accountImport) {
            switch ($type) {
                case 'original':
                    $accountImport->setOriginalData($data);

                    break;
                case 'json':
                    $accountImport->setJsonData($data);

                    break;
                case 'json_normalized':
                    $accountImport->setJsonNormalizedData($data);

                    break;
            }

            $this->entityManager->flush();
        }
    }

    /**
     * Returns next import id to be used.
     */
    protected function getNextImportId(Account $account): int
    {
        return $this->accountImportRepository->getNextImportId($account);
    }
}
