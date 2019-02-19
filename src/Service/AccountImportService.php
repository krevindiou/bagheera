<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Account;
use App\Entity\AccountImport;
use Doctrine\ORM\EntityManagerInterface;

class AccountImportService
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    /**
     * Returns current import.
     */
    public function getCurrentImport(Account $account): AccountImport
    {
        return $this->em->getRepository('App:AccountImport')->findOneBy(
            [
                'account' => $account->getAccountId(),
                'finished' => 0,
            ]
        );
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
            $this->em->persist($accountImport);
            $this->em->flush();
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

            $this->em->flush();
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

            $this->em->flush();
        }
    }

    /**
     * Saves transactions data depending on type.
     *
     * @param Account $account Account entity
     * @param string  $data    Data to save
     * @param string  $type    Either original, json or json_normalized
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

            $this->em->flush();
        }
    }

    /**
     * Returns next import id to be used.
     */
    protected function getNextImportId(Account $account): int
    {
        return $this->em->getRepository('App:AccountImport')->getNextImportId($account);
    }
}
