<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
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
                        'class' => 'input-xlarge',
                        'autocomplete' => 'off'
                    )
                )
            )
            ->add(
                'category',
                null,
                array(
                    'label' => 'scheduler_category',
                    'empty_value' => '',
                    'required' => false,
                    'group_by' => 'type',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
            ->add(
                'paymentMethod',
                null,
                array(
                    'label' => 'scheduler_payment_method',
                    'empty_value' => '',
                    'group_by' => 'type',
                    'attr' => array(
                        'class' => 'input-medium'
                    )
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
                        'class' => 'input-small calendar'
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
                        'class' => 'input-small calendar'
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
                    ),
                    'attr' => array(
                        'class' => 'input-small'
                    )
                )
            )
            ->add(
                'frequencyValue',
                null,
                array(
                    'label' => 'scheduler_frequency_value',
                    'attr' => array(
                        'class' => 'input-mini'
                    )
                )
            )
            ->add(
                'notes',
                null,
                array(
                    'label' => 'scheduler_notes',
                    'attr' => array(
                        'rows' => 5,
                        'class' => 'input-xlarge'
                    )
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
                                    'debit' => 'scheduler_type_debit',
                                    'credit' => 'scheduler_type_credit'
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
                                ),
                                'attr' => array(
                                    'class' => 'input-small'
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
                                },
                                'attr' => array(
                                    'class' => 'input-xlarge'
                                )
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
