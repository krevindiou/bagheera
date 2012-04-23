<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Bridge\Monolog\Logger,
    Krevindiou\BagheeraBundle\Entity\Account,
    Krevindiou\BagheeraBundle\Entity\AccountImport;

/**
 * AccountImport service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
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
     * Init import progress data
     *
     * @param  Account $account Account entity
     * @param  integer $total   Total
     * @return void
     */
    public function initImport(Account $account, $total)
    {
        $accountImport = $this->_em->getRepository('KrevindiouBagheeraBundle:AccountImport')->findOneBy(
            array(
                'account' => $account->getAccountId(),
                'finished' => 0
            )
        );

        if (null === $accountImport) {
            $dql = 'SELECT MAX(i.importId) ';
            $dql.= 'FROM KrevindiouBagheeraBundle:AccountImport i ';
            $dql.= 'JOIN i.account a ';
            $dql.= 'JOIN a.bank b ';
            $dql.= 'WHERE b.user = :user ';
            $dql.= 'AND i.finished = 1 ';
            $query = $this->_em->createQuery($dql);
            $query->setParameter('user', $account->getBank()->getUser());
            $importId = (int)$query->getSingleScalarResult() + 1;

            $accountImport = new AccountImport();
            $accountImport->setImportId($importId);
            $accountImport->setAccount($account);
            $this->_em->persist($accountImport);
        }

        $accountImport->setTotal($total);

        $this->_em->flush();
    }

    /**
     * Updates import progress data
     *
     * @param  Account $account     Account entity
     * @param  integer $progress    Current progress
     * @return void
     */
    public function updateImport(Account $account, $progress)
    {
        $accountImport = $this->_em->getRepository('KrevindiouBagheeraBundle:AccountImport')->findOneBy(
            array(
                'account' => $account->getAccountId(),
                'finished' => 0
            )
        );

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
        $accountImport = $this->_em->getRepository('KrevindiouBagheeraBundle:AccountImport')->findOneBy(
            array(
                'account' => $account->getAccountId(),
                'finished' => 0
            )
        );

        if (null !== $accountImport) {
            $accountImport->setFinished(true);

            $this->_em->flush();
        }
    }
}
