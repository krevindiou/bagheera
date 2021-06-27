<?php

declare(strict_types=1);

namespace App\Validator\Constraints;

use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\Exception\MissingOptionsException;

/**
 * @Annotation
 */
class FieldExists extends Constraint
{
    public string $message = 'field_does_not_exist';
    public string $className;
    public string $field;

    public function __construct($options = null)
    {
        parent::__construct($options);

        if ('' === $this->className || '' === $this->field) {
            throw new MissingOptionsException(sprintf('Option "className" and "field" must be given for constraint %s', __CLASS__), ['className', 'field']);
        }
    }
}
