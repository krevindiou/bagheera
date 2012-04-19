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
use Krevindiou\BagheeraBundle\Entity\Account;
use Krevindiou\BagheeraBundle\Form\EventListener\OperationAmountFieldSubscriber;

/**
 * Operation form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationForm extends AbstractType
{
    /**
     * @var Account
     */
    protected $_account;


    /**
     * @param Account $account
     */
    public function __construct(Account $account)
    {
        $this->_account = $account;
    }

    public function buildForm(FormBuilder $builder, array $options)
    {
        $account = $this->_account;

        $subscriber = new OperationAmountFieldSubscriber($builder->getFormFactory());
        $builder->addEventSubscriber($subscriber);

        $builder
            ->add(
                'type',
                'choice',
                array(
                    'label' => 'operation_type',
                    'data' => 'debit',
                    'property_path' => false,
                    'expanded' => true,
                    'required' => false,
                    'choices' => array(
                        'debit' => 'operation_type_debit',
                        'credit' => 'operation_type_credit'
                    )
                )
            )
            ->add(
                'thirdParty',
                null,
                array(
                    'label' => 'operation_third_party',
                    'attr' => array(
                        'size' => 40
                    )
                )
            )
            ->add(
                'amount',
                'money',
                array(
                    'label' => 'operation_amount',
                    'currency' => false,
                    'property_path' => false
                )
            )
            ->add(
                'category',
                null,
                array(
                    'label' => 'operation_category',
                    'property' => 'dropDownListLabel',
                    'empty_value' => '',
                    'required' => false
                )
            )
            ->add(
                'paymentMethod',
                null,
                array(
                    'label' => 'operation_payment_method',
                    'property' => 'dropDownListLabel',
                    'empty_value' => ''
                )
            )
            ->add(
                'transferAccount',
                null,
                array(
                    'label' => 'operation_transfer_account',
                    'empty_value' => 'operation_external_account',
                    'class' => 'Krevindiou\BagheeraBundle\Entity\Account',
                    'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($account) {
                        return $repository->createQueryBuilder('a')
                            ->innerJoin('a.bank', 'b')
                            ->where('b.user = :user')
                            ->andWhere('a != :account')
                            ->setParameter('user', $account->getBank()->getUser())
                            ->setParameter('account', $account)
                            ->add('orderBy', 'a.name ASC');
                    }
                )
            )
            ->add(
                'valueDate',
                null,
                array(
                    'label' => 'operation_value_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'attr' => array(
                        'size' => 12,
                        'class' => 'calendar'
                    )
                )
            )
            ->add(
                'notes',
                null,
                array(
                    'label' => 'operation_notes',
                    'attr' => array('cols' => 40, 'rows' => 5)
                )
            )
            ->add(
                'isReconciled',
                null,
                array(
                    'label' => 'operation_is_reconciled',
                    'required' => false
                )
            )
        ;

        $builder->addValidator(
            new CallbackValidator(
                function(FormInterface $form)
                {
                    $validator = new Assert\NotBlankValidator();
                    $constraint = new Assert\NotBlank();

                    if (!$validator->isValid($form['type']->getData(), $constraint)) {
                        $form->get('type')->addError(new FormError($constraint->message));
                    }

                    if (!$validator->isValid($form['amount']->getData(), $constraint)) {
                        $form->get('amount')->addError(new FormError($constraint->message));
                    }
                }
            )
        );
    }

    public function getDefaultOptions(array $options)
    {
        $options['data_class'] = 'Krevindiou\BagheeraBundle\Entity\Operation';

        return $options;
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_operationtype';
    }
}
