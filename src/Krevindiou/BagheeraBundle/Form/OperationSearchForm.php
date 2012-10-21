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
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use Krevindiou\BagheeraBundle\Entity\Account;
use Krevindiou\BagheeraBundle\Form\EventListener\OperationSearchAmountFieldSubscriber;

/**
 * Operation form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationSearchForm extends AbstractType
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

    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $account = $this->_account;

        $subscriber = new OperationSearchAmountFieldSubscriber($builder->getFormFactory());
        $builder->addEventSubscriber($subscriber);

        $builder
            ->add(
                'type',
                'choice',
                array(
                    'label' => 'operation_type',
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
                        'size' => 30
                    )
                )
            )
            ->add(
                'amount_comparator_1',
                'choice',
                array(
                    'mapped' => false,
                    'required' => false,
                    'empty_value' => '',
                    'choices' => array(
                        'inferiorTo' => '<',
                        'inferiorOrEqualTo' => '<=',
                        'equalTo' => '=',
                        'superiorOrEqualTo' => '>',
                        'superiorTo' => '>=',
                    )
                )
            )
            ->add(
                'amount_1',
                'money',
                array(
                    'label' => 'operation_amount',
                    'currency' => $options['data']->getAccount()->getCurrency(),
                    'mapped' => false,
                    'required' => false
                )
            )
            ->add(
                'amount_comparator_2',
                'choice',
                array(
                    'mapped' => false,
                    'required' => false,
                    'empty_value' => '',
                    'choices' => array(
                        'inferiorTo' => '<',
                        'inferiorOrEqualTo' => '<=',
                        'equalTo' => '=',
                        'superiorOrEqualTo' => '>',
                        'superiorTo' => '>=',
                    )
                )
            )
            ->add(
                'amount_2',
                'money',
                array(
                    'currency' => $options['data']->getAccount()->getCurrency(),
                    'mapped' => false,
                    'required' => false
                )
            )
            ->add(
                'categories',
                null,
                array(
                    'label' => 'operation_category',
                    'required' => false,
                    'property' => 'dropDownListLabel',
                )
            )
            ->add(
                'paymentMethods',
                null,
                array(
                    'label' => 'operation_payment_method',
                    'required' => false,
                    'property' => 'dropDownListLabel',
                )
            )
            ->add(
                'valueDateStart',
                'date',
                array(
                    'label' => 'operation_search_value_date_start',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'required' => false,
                    'attr' => array(
                        'size' => 12,
                        'class' => 'calendar'
                    )
                )
            )
            ->add(
                'valueDateEnd',
                'date',
                array(
                    'label' => 'operation_search_value_date_end',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'required' => false,
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
                    'attr' => array(
                        'size' => 30
                    )
                )
            )
            ->add(
                'isReconciled',
                'choice',
                array(
                    'label' => 'operation_is_reconciled',
                    'required' => false,
                    'empty_value' => 'operation_search_reconciled_both',
                    'choices' => array(
                        1 => 'operation_search_only_reconciled',
                        0 => 'operation_search_only_not_reconciled',
                    )
                )
            )
        ;
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\OperationSearch'
            )
        );
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_operationsearchtype';
    }
}
