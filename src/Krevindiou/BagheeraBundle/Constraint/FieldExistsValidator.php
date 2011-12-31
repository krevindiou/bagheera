<?php

namespace Krevindiou\BagheeraBundle\Constraint;

use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Constraint;

class FieldExistsValidator extends ConstraintValidator
{
    /**
     * @var RegistryInterface
     */
    private $_registry;


    /**
     * @param RegistryInterface $registry
     */
    public function __construct(RegistryInterface $registry)
    {
        $this->_registry = $registry;
    }

    public function isValid($value, Constraint $constraint)
    {
        $em = $this->_registry->getEntityManager($constraint->em);

        $repository = $em->getRepository($constraint->className);
        $result = $repository->findBy(array($constraint->field => $value));
        if (empty($result)) {
            $this->setMessage($constraint->message);

            return false;
        }

        return true;
    }
}
