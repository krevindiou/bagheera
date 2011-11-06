<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilder;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormError;
use Symfony\Component\Form\CallbackValidator;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Transaction form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class TransactionForm extends AbstractType
{
    public function buildForm(FormBuilder $builder, array $options)
    {
        $builder
            ->add(
                'debitCredit',
                'choice',
                 array(
                    'property_path' => false,
                    'choices' => array(
                        'debit' => 'debit',
                        'credit' => 'credit',
                    )
                )
            )
            ->add('thirdParty')
            ->add(
                'amount',
                'money',
                array(
                    'property_path' => false,
                    'currency' => false
                )
            )
            ->add('valueDate')
            ->add('isReconciled')
            ->add('notes')
            ->add(
                'transferAccount',
                'entity',
                 array(
                    'property_path' => false,
                    'class' => 'KrevindiouBagheeraBundle:Account',
                )
            )
            ->add('category')
            ->add('paymentMethod')
        ;

        $builder->addValidator(
            new CallbackValidator(
                function(FormInterface $form)
                {
                    $validator = new Assert\NotBlankValidator();
                    $constraint = new Assert\NotBlank();

                    if (!$validator->isValid($form['debitCredit']->getData(), $constraint)) {
                        $form->addError(new FormError($constraint->message));
                    }


                    $validator = new Assert\ChoiceValidator();
                    $constraint = new Assert\Choice(array('choices' => array('debit', 'credit')));

                    if (!$validator->isValid($form['debitCredit']->getData(), $constraint)) {
                        $form->addError(new FormError($constraint->message));
                    }
                }
            )
        );

        $builder->addValidator(
            new CallbackValidator(
                function(FormInterface $form)
                {
                    $validator = new Assert\NotBlankValidator();
                    $constraint = new Assert\NotBlank();

                    if (!$validator->isValid($form['amount']->getData(), $constraint)) {
                        $form->addError(new FormError($constraint->message));
                    }
                }
            )
        );
    }

    public function getDefaultOptions(array $options)
    {
        $options['data_class'] = 'Krevindiou\BagheeraBundle\Entity\Transaction';

        return $options;
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_transactiontype';
    }
}
