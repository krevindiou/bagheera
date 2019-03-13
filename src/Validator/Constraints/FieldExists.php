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
    /** @var string */
    public $message = 'field_does_not_exist';

    /** @var string */
    public $className;

    /** @var string */
    public $field;

    public function __construct($options = null)
    {
        parent::__construct($options);

        if (null === $this->className || null === $this->field) {
            throw new MissingOptionsException(sprintf('Option "className" and "field" must be given for constraint %s', __CLASS__), ['className', 'field']);
        }
    }
}
