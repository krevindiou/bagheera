<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Service;

use Doctrine\ORM\EntityManager,
    Symfony\Component\Form\Form,
    Symfony\Component\Form\FormFactory,
    Symfony\Component\Validator\Validator,
    Symfony\Bridge\Monolog\Logger,
    Symfony\Component\Process\PhpExecutableFinder,
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Form\BankForm;

/**
 * Bank service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankService
{
    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var FormFactory
     */
    protected $_formFactory;

    /**
     * @var Validator
     */
    protected $_validator;

    /**
     * @var AccountService
     */
    protected $_accountService;

    /**
     * @var string
     */
    protected $_rootDir;

    /**
     * @var string
     */
    protected $_environment;

    public function __construct(
        Logger $logger,
        EntityManager $em,
        FormFactory $formFactory,
        Validator $validator,
        AccountService $accountService,
        $rootDir,
        $environment)
    {
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_accountService = $accountService;
        $this->_rootDir = $rootDir;
        $this->_environment = $environment;
    }

    /**
     * Returns banks list
     *
     * @param  User  $user    User entity
     * @param  bool  $deleted Return deleted items
     * @return array
     */
    public function getList(User $user, $deleted = true)
    {
        $dql = 'SELECT b FROM KrevindiouBagheeraBundle:Bank b ';
        $dql.= 'WHERE b.user = :user ';
        if (!$deleted) {
            $dql.= 'AND b.isDeleted = 0 ';
        }
        $dql.= 'ORDER BY b.displayOrder ASC';

        $query = $this->_em->createQuery($dql);
        $query->setParameter('user', $user);

        return $query->getResult();
    }

    /**
     * Returns bank form
     *
     * @param  User $user User entity
     * @param  Bank $bank Bank entity
     * @return Form
     */
    public function getForm(User $user, Bank $bank = null)
    {
        if (null === $bank) {
            $bank = new Bank();
            $bank->setUser($user);
        } elseif ($user !== $bank->getUser()) {
            return;
        }

        $form = $this->_formFactory->create(new BankForm(), $bank);

        return $form;
    }

    /**
     * Saves bank
     *
     * @param  User    $user User entity
     * @param  Bank    $bank Bank entity
     * @return boolean
     */
    protected function _save(User $user, Bank $bank)
    {
        if ($user === $bank->getUser()) {
            try {
                if (null === $bank->getBankId()) {
                    $banks = $bank->getUser()->getBanks();
                    $order = count($banks) + 1;

                    $bank->setDisplayOrder($order);
                }

                $this->_em->persist($bank);
                $this->_em->flush();

                return true;
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
            }
        }

        return false;
    }

    /**
     * Saves bank
     *
     * @param  User    $user User entity
     * @param  Bank    $bank Bank entity
     * @return boolean
     */
    public function save(User $user, Bank $bank)
    {
        $errors = $this->_validator->validate($bank);

        if (0 == count($errors)) {
            return $this->_save($user, $bank);
        }

        return false;
    }

    /**
     * Saves bank form
     *
     * @param  User    $user User entity
     * @param  Form    $form Bank form
     * @return boolean
     */
    public function saveForm(User $user, Form $form)
    {
        if ($form->isValid()) {
            return $this->_save($user, $form->getData());
        }

        return false;
    }

    /**
     * Deletes banks
     *
     * @param  User    $user    User entity
     * @param  array   $banksId Banks id to delete
     * @return boolean
     */
    public function delete(User $user, array $banksId)
    {
        try {
            foreach ($banksId as $bankId) {
                $bank = $this->_em->find('KrevindiouBagheeraBundle:Bank', $bankId);

                if (null !== $bank) {
                    if ($user === $bank->getUser()) {
                        $bank->setIsDeleted(true);
                    }
                }
            }

            $this->_em->flush();
        } catch (\Exception $e) {
            $this->_logger->err($e->getMessage());

            return false;
        }

        return true;
    }

    /**
     * Gets bank balances
     *
     * @param  User  $user User entity
     * @param  Bank  $bank Bank entity
     * @return array
     */
    public function getBalances(User $user, Bank $bank)
    {
        $balances = array();

        if ($user === $bank->getUser()) {
            $accounts = $bank->getAccounts();
            foreach ($accounts as $account) {
                if (!$account->isDeleted()) {
                    $accountBalance = $this->_accountService->getBalance($user, $account);

                    if (isset($balances[$account->getCurrency()])) {
                        $balances[$account->getCurrency()]+= sprintf('%.2f', $accountBalance);
                    } else {
                        $balances[$account->getCurrency()] = sprintf('%.2f', $accountBalance);
                    }
                }
            }
        }

        return $balances;
    }

    /**
     * Retrieves external bank data
     *
     * @param  Bank $bank Bank entity
     * @return void
     */
    public function importExternalBank(Bank $bank)
    {
        if (null !== $bank->getProvider()) {
            $executableFinder = new PhpExecutableFinder();

            $phpBin = $executableFinder->find();

            if (null === $phpBin) {
                $this->_logger->err('Unable to find php binary');

                return;
            }

            $cmd = sprintf(
                '%s > /dev/null 2>&1 & echo $!',
                sprintf(
                    '%s %s/console --env=%s bagheera:import_external_bank %d',
                    $phpBin,
                    $this->_rootDir,
                    $this->_environment,
                    $bank->getBankId()
                )
            );

            exec($cmd);
        }
    }
}
