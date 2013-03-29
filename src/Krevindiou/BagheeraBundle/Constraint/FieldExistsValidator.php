<?php

namespace Krevindiou\BagheeraBundle\Constraint;

use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Constraint;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\Validator("bagheera.validator.field_exists")
 */
class FieldExistsValidator extends ConstraintValidator
{
    /** @DI\Inject("doctrine") */
    public $registry;

    public function validate($value, Constraint $constraint)
    {
        $em = $this->registry->getEntityManager($constraint->em);

        $repository = $em->getRepository($constraint->className);
        $result = $repository->findBy(array($constraint->field => $value));
        if (empty($result)) {
            $this->context->addViolation($constraint->message);
        }
    }
}
