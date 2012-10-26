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
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;

/**
 * Operation form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class OperationForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
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
                'category',
                null,
                array(
                    'label' => 'operation_category',
                    'empty_value' => '',
                    'required' => false,
                    'group_by' => 'type'
                )
            )
            ->add(
                'paymentMethod',
                null,
                array(
                    'label' => 'operation_payment_method',
                    'empty_value' => '',
                    'group_by' => 'type'
                )
            )
            ->add(
                'valueDate',
                'date',
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

        $builder->addEventListener(
            FormEvents::PRE_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $operation = $event->getData();

                $account = $operation->getAccount();

                $form
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'type',
                            'choice',
                            null,
                            array(
                                'label' => 'operation_type',
                                'mapped' => false,
                                'expanded' => true,
                                'required' => false,
                                'choices' => array(
                                    'debit' => 'operation_type_debit',
                                    'credit' => 'operation_type_credit'
                                ),
                                'constraints' => array(
                                    new Assert\NotBlank()
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'amount',
                            'money',
                            null,
                            array(
                                'label' => 'operation_amount',
                                'currency' => $account->getCurrency(),
                                'mapped' => false,
                                'constraints' => array(
                                    new Assert\NotBlank()
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'transferAccount',
                            'entity',
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
                    )
                ;

                $debit = $operation->getDebit();
                $credit = $operation->getCredit();

                if (0 != $debit) {
                    $form->get('type')->setData('debit');
                    $form->get('amount')->setData($debit);
                } elseif (0 != $credit) {
                    $form->get('type')->setData('credit');
                    $form->get('amount')->setData($credit);
                } else {
                    $form->get('type')->setData('debit');
                }
            }
        );

        $builder->addEventListener(
            FormEvents::POST_BIND,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $operation = $event->getData();

                $type = $form->get('type')->getData();
                $amount = $form->get('amount')->getData();

                if ('debit' == $type) {
                    $operation->setDebit($amount);
                    $operation->setCredit(0);
                } elseif ('credit' == $type) {
                    $operation->setDebit(0);
                    $operation->setCredit($amount);
                }
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Operation'
            )
        );
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_operationtype';
    }
}
