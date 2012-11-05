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
    Krevindiou\BagheeraBundle\Entity\User,
    Krevindiou\BagheeraBundle\Entity\Bank,
    Krevindiou\BagheeraBundle\Entity\BankAccess,
    Krevindiou\BagheeraBundle\Form\BankAccessForm;

/**
 * Bank access service
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class BankAccessService
{
    /**
     * @var string
     */
    protected $_secret;

    /**
     * @var Logger
     */
    protected $_logger;

    /**
     * @var EntityManager
     */
    protected $_em;

    /**
     * @var EntityManager
     */
    protected $_emSecure;

    /**
     * @var FormFactory
     */
    protected $_formFactory;

    /**
     * @var Validator
     */
    protected $_validator;

    /**
     * @var BankService
     */
    protected $_bankService;

    public function __construct(
        $secret,
        Logger $logger,
        EntityManager $em,
        EntityManager $emSecure,
        FormFactory $formFactory,
        Validator $validator,
        BankService $bankService)
    {
        $this->_secret = $secret;
        $this->_logger = $logger;
        $this->_em = $em;
        $this->_emSecure = $emSecure;
        $this->_formFactory = $formFactory;
        $this->_validator = $validator;
        $this->_bankService = $bankService;
    }

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

        $form = $this->_formFactory->create(new BankAccessForm(), $bankAccess);

        return $form;
    }

    /**
     * Saves bank access
     *
     * @param  User       $user       User entity
     * @param  BankAccess $bankAccess BankAccess entity
     * @return boolean
     */
    protected function _save(User $user, BankAccess $bankAccess)
    {
        $bank = $this->_em->find('KrevindiouBagheeraBundle:Bank', $bankAccess->getBankId());

        if (null !== $bank && $user === $bank->getUser()) {
            try {
                // Delete previous access data
                $dql = 'DELETE FROM KrevindiouBagheeraBundle:BankAccess b ';
                $dql.= 'WHERE b.bankId = :bankId ';

                $this->_emSecure->createQuery($dql)
                    ->setParameter('bankId', $bankAccess->getBankId())
                    ->execute();

                $plainLogin = $bankAccess->getPlainLogin();
                $plainPassword = $bankAccess->getPlainPassword();

                // AES-256 => 32 bytes long key
                $key = $this->_secret;

                $iv = mcrypt_create_iv(mcrypt_get_iv_size(MCRYPT_RIJNDAEL_128, MCRYPT_MODE_CBC), MCRYPT_RAND);

                $encryptedLogin = mcrypt_encrypt(
                    MCRYPT_RIJNDAEL_128,
                    $key,
                    $plainLogin,
                    MCRYPT_MODE_CBC,
                    $iv
                );

                $encryptedLogin = base64_encode($iv . $encryptedLogin);

                $iv = mcrypt_create_iv(mcrypt_get_iv_size(MCRYPT_RIJNDAEL_128, MCRYPT_MODE_CBC), MCRYPT_RAND);

                $encryptedPassword = mcrypt_encrypt(
                    MCRYPT_RIJNDAEL_128,
                    $key,
                    $plainPassword,
                    MCRYPT_MODE_CBC,
                    $iv
                );

                $encryptedPassword = base64_encode($iv . $encryptedPassword);

                if ('' != $encryptedLogin && '' != $encryptedPassword) {
                    $bankAccess->setLogin($encryptedLogin);
                    $bankAccess->setPassword($encryptedPassword);
                    $bankAccess->setPlainLogin('');
                    $bankAccess->setPlainPassword('');

                    $this->_emSecure->persist($bankAccess);
                    $this->_emSecure->flush();

                    $this->_bankService->importExternalBank($bank);

                    return true;
                }
            } catch (\Exception $e) {
                $this->_logger->err($e->getMessage());
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
        $errors = $this->_validator->validate($bankAccess);

        if (0 == count($errors)) {
            return $this->_save($user, $bankAccess);
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
            return $this->_save($user, $form->getData());
        }

        return false;
    }
}
