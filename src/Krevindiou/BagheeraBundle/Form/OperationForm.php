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
                    'label' => 'operation_third_party',
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
                    'label' => 'operation_category',
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
                    'label' => 'operation_payment_method',
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
                    'label' => 'operation_value_date',
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
                    'label' => 'operation_notes',
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
                    'label' => 'operation_reconciled',
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
                                },
                                'attr' => array(
                                    'class' => 'input-xlarge'
                                )
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
