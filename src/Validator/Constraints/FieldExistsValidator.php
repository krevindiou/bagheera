<?php

namespace App\Validator\Constraints;

use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;
use Doctrine\ORM\EntityManagerInterface;

class FieldExistsValidator extends ConstraintValidator
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    public function validate($value, Constraint $constraint)
    {
        if (!$constraint instanceof FieldExists) {
            throw new UnexpectedTypeException($constraint, FieldExists::class);
        }

        if (!is_string($value)) {
            throw new UnexpectedValueException($value, 'string');
        }

        if (null === $value || '' === $value) {
            return;
        }

        $repository = $this->em->getRepository($constraint->className);
        $result = $repository->findBy([$constraint->field => $value]);
        if (empty($result)) {
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ string }}', $value)
                ->addViolation();
        }
    }
}
