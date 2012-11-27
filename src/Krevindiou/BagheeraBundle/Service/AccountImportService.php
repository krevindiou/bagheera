<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\AccountImport;

/**
 * AccountImport service
 *
 */
class AccountImportService
{
    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    public function __construct(Logger $logger, EntityManager $em)
    {
        $this->_logger = $logger;
        $this->_em = $em;
    }

    /**
     * Returns next import id to be used
     *
     * @param  Account $account Account entity
     * @return integer
     */
    protected function _getNextImportId(Account $account)
    {
        $dql = 'SELECT MAX(i.importId) ';
        $dql.= 'FROM KrevindiouBagheeraBundle:AccountImport i ';
        $dql.= 'JOIN i.account a ';
        $dql.= 'JOIN a.bank b ';
        $dql.= 'WHERE b.user = :user ';
        $dql.= 'AND i.finished = 1 ';
        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $account->getBank()->getUser());

        return (int) $query->getSingleScalarResult() + 1;
    }

    /**
     * Returns current import
     *
     * @param  Account       $account Account entity
     * @return AccountImport
     */
    public function getCurrentImport(Account $account)
    {
        return $this->_em->getRepository('KrevindiouBagheeraBundle:AccountImport')->findOneBy(
            array(
                'account' => $account->getAccountId(),
                'finished' => 0
            )
        );
    }

    /**
     * Init import progress data
     *
     * @param  Account $account Account entity
     * @param  integer $total   Total
     * @return void
     */
    public function initImport(Account $account)
    {
        $accountImport = $this->getCurrentImport($account);

        if (null === $accountImport) {
            $importId = $this->_getNextImportId($account);

            $accountImport = new AccountImport();
            $accountImport->setImportId($importId);
            $accountImport->setAccount($account);
            $this->_em->persist($accountImport);
            $this->_em->flush();
        }
    }

    /**
     * Updates import progress data
     *
     * @param  Account $account  Account entity
     * @param  integer $progress Current progress
     * @return void
     */
    public function updateImport(Account $account, $progress)
    {
        $accountImport = $this->getCurrentImport($account);

        if (null !== $accountImport) {
            $accountImport->setProgress($progress);

            $this->_em->flush();
        }
    }

    /**
     * Closes import progress data
     *
     * @param  Account $account Account entity
     * @return void
     */
    public function closeImport(Account $account)
    {
        $accountImport = $this->getCurrentImport($account);

        if (null !== $accountImport) {
            $accountImport->setFinished(true);

            $this->_em->flush();
        }
    }

    /**
     * Saves transactions data depending on type
     *
     * @param  Account $account Account entity
     * @param  string  $data    Data to save
     * @param  string  $type    Either original, json or json_normalized
     * @return void
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

            $this->_em->flush();
        }
    }
}
