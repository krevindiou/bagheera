<?php

namespace Krevindiou\BagheeraBundle\Constraint;

use Symfony\Component\Validator\Constraint;

/**
 * @Annotation
 */
class FieldExists extends Constraint
{
    /**
     * @var string
     */
    public $message = 'field_does_not_exist';

    /**
     * @var string
     */
    public $className;

    /**
     * @var string
     */
    public $field;

    /**
     * @var string
     */
    public $em;


    /**
     * @param string $className
     * @param string $field
     * @param string $em
     */
    public function __construct($className, $field, $em = null)
    {
        $this->className = $className;
        $this->field = $field;
        $this->em = $em;
    }

    /**
     * {@inheritDoc}
     */
    public function validatedBy()
    {
        return 'bagheera.validator.field_exists';
    }
}
