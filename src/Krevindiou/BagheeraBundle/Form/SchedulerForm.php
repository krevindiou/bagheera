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
 * Scheduler form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
 */
class SchedulerForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'thirdParty',
                null,
                array(
                    'label' => 'scheduler_third_party',
                    'attr' => array(
                        'size' => 40
                    )
                )
            )

            ->add(
                'category',
                null,
                array(
                    'label' => 'scheduler_category',
                    'property' => 'dropDownListLabel',
                    'empty_value' => '',
                    'required' => false
                )
            )
            ->add(
                'paymentMethod',
                null,
                array(
                    'label' => 'scheduler_payment_method',
                    'property' => 'dropDownListLabel',
                    'empty_value' => ''
                )
            )
            ->add(
                'valueDate',
                'date',
                array(
                    'label' => 'scheduler_value_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'attr' => array(
                        'size' => 12,
                        'class' => 'calendar'
                    )
                )
            )
            ->add(
                'limitDate',
                'date',
                array(
                    'label' => 'scheduler_limit_date',
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
                'frequencyUnit',
                'choice',
                 array(
                    'label' => 'scheduler_frequency_unit',
                    'choices' => array(
                        'day' => 'scheduler_frequency_unit_day',
                        'week' => 'scheduler_frequency_unit_week',
                        'month' => 'scheduler_frequency_unit_month',
                        'year' => 'scheduler_frequency_unit_year',
                    )
                )
            )
            ->add(
                'frequencyValue',
                null,
                array(
                    'label' => 'scheduler_frequency_value',
                    'attr' => array(
                        'size' => 6,
                    )
                )
            )
            ->add(
                'notes',
                null,
                array(
                    'label' => 'scheduler_notes',
                    'attr' => array('cols' => 40, 'rows' => 5)
                )
            )
            ->add(
                'isReconciled',
                null,
                array(
                    'label' => 'scheduler_is_reconciled',
                    'required' => false
                )
            )
            ->add(
                'isActive',
                null,
                array(
                    'label' => 'scheduler_is_active',
                    'required' => false
                )
            )
        ;

        $builder->addEventListener(
            FormEvents::PRE_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $scheduler = $event->getData();

                $account = $scheduler->getAccount();

                $form
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'type',
                            'choice',
                            null,
                            array(
                                'label' => 'scheduler_type',
                                'mapped' => false,
                                'expanded' => true,
                                'required' => false,
                                'choices' => array(
                                    'debit' => 'scheduler_debit',
                                    'credit' => 'scheduler_credit'
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
                                'label' => 'scheduler_amount',
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
                                'label' => 'scheduler_transfer_account',
                                'empty_value' => 'scheduler_external_account',
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

                $debit = $scheduler->getDebit();
                $credit = $scheduler->getCredit();

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
                $scheduler = $event->getData();

                $type = $form->get('type')->getData();
                $amount = $form->get('amount')->getData();

                if ('debit' == $type) {
                    $scheduler->setDebit($amount);
                    $scheduler->setCredit(0);
                } elseif ('credit' == $type) {
                    $scheduler->setDebit(0);
                    $scheduler->setCredit($amount);
                }
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Scheduler'
            )
        );
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_schedulertype';
    }
}
