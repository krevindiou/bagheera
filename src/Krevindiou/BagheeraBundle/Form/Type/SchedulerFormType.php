<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class SchedulerFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'type',
                'choice',
                [
                    'label' => 'scheduler.type',
                    'mapped' => false,
                    'expanded' => true,
                    'required' => true,
                    'choices' => [
                        'debit' => 'scheduler.type_debit',
                        'credit' => 'scheduler.type_credit'
                    ],
                    'constraints' => [
                        new Assert\NotBlank()
                    ]
                ]
            )
            ->add(
                'thirdParty',
                null,
                [
                    'label' => 'scheduler.third_party',
                    'attr' => [
                        'class' => 'input-xlarge',
                        'autocomplete' => 'off'
                    ]
                ]
            )
            ->add(
                'category',
                null,
                [
                    'label' => 'scheduler.category',
                    'empty_value' => '',
                    'required' => false,
                    'group_by' => 'type',
                    'attr' => [
                        'class' => 'input-xlarge'
                    ]
                ]
            )
            ->add(
                'paymentMethod',
                null,
                [
                    'label' => 'scheduler.payment_method',
                    'empty_value' => '',
                    'group_by' => 'type',
                    'attr' => [
                        'class' => 'input-medium'
                    ]
                ]
            )
            ->add(
                'valueDate',
                'date',
                [
                    'label' => 'scheduler.value_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'attr' => [
                        'class' => 'input-small calendar'
                    ]
                ]
            )
            ->add(
                'limitDate',
                'date',
                [
                    'label' => 'scheduler.limit_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'required' => false,
                    'attr' => [
                        'class' => 'input-small calendar'
                    ]
                ]
            )
            ->add(
                'frequencyUnit',
                'choice',
                 [
                    'label' => 'scheduler.frequency_unit',
                    'choices' => [
                        'day' => 'scheduler.frequency_unit_day',
                        'week' => 'scheduler.frequency_unit_week',
                        'month' => 'scheduler.frequency_unit_month',
                        'year' => 'scheduler.frequency_unit_year',
                    ],
                    'attr' => [
                        'class' => 'input-small'
                    ]
                ]
            )
            ->add(
                'frequencyValue',
                null,
                [
                    'label' => 'scheduler.frequency_value',
                    'attr' => [
                        'class' => 'input-mini'
                    ]
                ]
            )
            ->add(
                'notes',
                null,
                [
                    'label' => 'scheduler.notes',
                    'attr' => [
                        'rows' => 5,
                        'class' => 'input-xlarge'
                    ]
                ]
            )
            ->add(
                'reconciled',
                null,
                [
                    'label' => 'scheduler.reconciled',
                    'required' => false
                ]
            )
            ->add(
                'active',
                null,
                [
                    'label' => 'scheduler.active',
                    'required' => false
                ]
            )
        ;

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $scheduler = $event->getData();

                $account = $scheduler->getAccount();

                $form
                    ->add(
                        'amount',
                        'money',
                        [
                            'label' => 'scheduler.amount',
                            'currency' => $account->getCurrency(),
                            'mapped' => false,
                            'constraints' => [
                                new Assert\NotBlank()
                            ],
                            'attr' => [
                                'class' => 'input-small'
                            ]
                        ]
                    )
                    ->add(
                        'transferAccount',
                        'entity',
                        [
                            'label' => 'scheduler.transfer_account',
                            'required' => false,
                            'empty_value' => 'scheduler.external_account',
                            'class' => 'Krevindiou\BagheeraBundle\Entity\Account',
                            'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($account) {
                                return $repository->createQueryBuilder('a')
                                    ->innerJoin('a.bank', 'b')
                                    ->where('b.member = :member')
                                    ->andWhere('a != :account')
                                    ->setParameter('member', $account->getBank()->getMember())
                                    ->setParameter('account', $account)
                                    ->add('orderBy', 'b.name ASC, a.name ASC');
                            },
                            'attr' => [
                                'class' => 'input-xlarge'
                            ]
                        ]
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
            [
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Scheduler'
            ]
        );
    }

    public function getName()
    {
        return 'scheduler';
    }
}
