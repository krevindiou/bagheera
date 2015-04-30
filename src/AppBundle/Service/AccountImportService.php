<?php

/**
 * This file is part of the Bagheera project, a personal finance manager.
 */
namespace AppBundle\Service;

use JMS\DiExtraBundle\Annotation as DI;
use AppBundle\Entity\Account;
use AppBundle\Entity\AccountImport;

/**
 * @DI\Service("app.account_import")
 * @DI\Tag("monolog.logger", attributes = {"channel" = "account_import"})
 */
class AccountImportService
{
    /** @DI\Inject */
    public $logger;

    /** @DI\Inject("doctrine.orm.entity_manager") */
    public $em;

    /**
     * Returns next import id to be used.
     *
     * @param Account $account Account entity
     *
     * @return int
     */
    protected function getNextImportId(Account $account)
    {
        $dql = 'SELECT MAX(i.importId) ';
        $dql .= 'FROM AppBundle:AccountImport i ';
        $dql .= 'JOIN i.account a ';
        $dql .= 'JOIN a.bank b ';
        $dql .= 'WHERE b.member = :member ';
        $dql .= 'AND i.finished = true ';
        $query = $this->em->createQuery($dql);
        $query->setParameter('member', $account->getBank()->getMember());

        return (int) $query->getSingleScalarResult() + 1;
    }

    /**
     * Returns current import.
     *
     * @param Account $account Account entity
     *
     * @return AccountImport
     */
    public function getCurrentImport(Account $account)
    {
        return $this->em->getRepository('AppBundle:AccountImport')->findOneBy(
            [
                'account' => $account->getAccountId(),
                'finished' => 0,
            ]
        );
    }

    /**
     * Init import progress data.
     *
     * @param Account $account Account entity
     * @param int     $total   Total
     */
    public function initImport(Account $account)
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
     *
     * @param Account $account  Account entity
     * @param int     $progress Current progress
     */
    public function updateImport(Account $account, $progress)
    {
        $accountImport = $this->getCurrentImport($account);

        if (null !== $accountImport) {
            $accountImport->setProgress($progress);

            $this->em->flush();
        }
    }

    /**
     * Closes import progress data.
     *
     * @param Account $account Account entity
     */
    public function closeImport(Account $account)
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
    public function setData(Account $account, $data, $type)
    {
        $accountImport = $this->getCurrentImport($account);

        if (null !== $accountImport) {
            switch ($type) {
                case 'original' :
                    $accountImport->setOriginalData($data);
                    break;

                case 'json' :
                    $accountImport->setJsonData($data);
                    break;

                case 'json_normalized' :
                    $accountImport->setJsonNormalizedData($data);
                    break;
            }

            $this->em->flush();
        }
    }
}
