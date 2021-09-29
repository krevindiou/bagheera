<?php

declare(strict_types=1);

namespace App\Validator\Constraints;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;

class FieldExistsValidator extends ConstraintValidator
{
    private EntityManagerInterface $entityManager;

    /**
     * @template T
     *
     * @var EntityRepository<T>
     */
    private EntityRepository $repository;

    public function __construct(EntityManagerInterface $entityManager)
    {
        $this->entityManager = $entityManager;
    }

    public function validate($value, Constraint $constraint): void
    {
        if (!$constraint instanceof FieldExists) {
            throw new UnexpectedTypeException($constraint, FieldExists::class);
        }

        if (!is_string($value)) {
            throw new UnexpectedValueException($value, 'string');
        }

        if ('' === $value) {
            return;
        }

        $className = $constraint->className;
        // @var class-string $className
        $this->repository = $this->entityManager->getRepository($className);
        $result = $this->repository->findBy([$constraint->field => $value]);
        if (empty($result)) {
            $this->context->buildViolation($constraint->message)
                ->setParameter('{{ string }}', $value)
                ->addViolation()
            ;
        }
    }
}
