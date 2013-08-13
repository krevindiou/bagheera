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
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
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
                    'label' => 'operation.third_party',
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
                    'label' => 'operation.category',
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
                    'label' => 'operation.payment_method',
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
                    'label' => 'operation.value_date',
                    'widget' => 'single_text',
                    'format' => 'yyyy-MM-dd',
                    'attr' => array(
                        'class' => 'input-small calendar'
                    )
                )
            )
            ->add(
                'notes',
                null,
                array(
                    'label' => 'operation.notes',
                    'attr' => array(
                        'class' => 'input-xlarge',
                        'rows' => 5
                    )
                )
            )
            ->add(
                'reconciled',
                null,
                array(
                    'label' => 'operation.reconciled',
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
                        'type',
                        'choice',
                        array(
                            'label' => 'operation.type',
                            'mapped' => false,
                            'expanded' => true,
                            'required' => true,
                            'choices' => array(
                                'debit' => 'operation.type_debit',
                                'credit' => 'operation.type_credit'
                            ),
                            'constraints' => array(
                                new Assert\NotBlank()
                            )
                        )
                    )
                    ->add(
                        'amount',
                        'money',
                        array(
                            'label' => 'operation.amount',
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
                    ->add(
                        'transferAccount',
                        'entity',
                        array(
                            'label' => 'operation.transfer_account',
                            'required' => false,
                            'empty_value' => 'operation.external_account',
                            'class' => 'Krevindiou\BagheeraBundle\Entity\Account',
                            'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($account) {
                                return $repository->createQueryBuilder('a')
                                    ->innerJoin('a.bank', 'b')
                                    ->where('b.member = :member')
                                    ->andWhere('a != :account')
                                    ->setParameter('member', $account->getBank()->getMember())
                                    ->setParameter('account', $account)
                                    ->add('orderBy', 'a.name ASC');
                            },
                            'attr' => array(
                                'class' => 'input-xlarge'
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
        return 'operation_type';
    }
}
