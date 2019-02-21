<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Form\DataTransformer\MoneyTransformer;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\MoneyType as CoreMoneyType;
use Symfony\Component\Form\FormBuilderInterface;

class MoneyType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->addModelTransformer(new MoneyTransformer())
        ;
    }

    public function getParent()
    {
        return CoreMoneyType::class;
    }

    public function getBlockPrefix()
    {
        return 'bagheera_money';
    }
}
