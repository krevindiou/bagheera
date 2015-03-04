<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace AppBundle\Constraint;

use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Constraint;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\Validator("app.validator.field_exists")
 */
class FieldExistsValidator extends ConstraintValidator
{
    /** @DI\Inject("doctrine") */
    public $doctrine;

    public function validate($value, Constraint $constraint)
    {
        if (null === $value) {
            return;
        }

        $em = $this->doctrine->getManager($constraint->em);

        $repository = $em->getRepository($constraint->className);
        $result = $repository->findBy([$constraint->field => $value]);
        if (empty($result)) {
            $this->context->addViolation($constraint->message);
        }
    }
}
