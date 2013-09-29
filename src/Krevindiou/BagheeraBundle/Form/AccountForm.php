<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;
use Krevindiou\BagheeraBundle\Form\Type\CurrencyType;

/**
 * @DI\FormType
 */
class AccountForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'name',
                null,
                array(
                    'label' => 'account.name',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
        ;

        $member = $options['member'];

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function(FormEvent $event) use ($builder, $member) {
                $form = $event->getForm();
                $account = $event->getData();

                $edit = (null !== $account->getAccountId());

                $form
                    ->add(
                        'bank',
                        'entity',
                        array(
                            'label' => 'account.bank',
                            'empty_value' => '',
                            'class' => 'Krevindiou\BagheeraBundle\Entity\Bank',
                            'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($member) {
                                return $repository->createQueryBuilder('b')
                                    ->where('b.member = :member')
                                    ->andWhere('b.deleted = false')
                                    ->andWhere('b.closed = false')
                                    ->setParameter('member', $member)
                                    ->add('orderBy', 'b.name ASC');
                            },
                            'disabled' => $edit,
                            'attr' => array(
                                'class' => 'input-xlarge'
                            )
                        )
                    )
                    ->add(
                        'currency',
                        new CurrencyType(),
                        array(
                            'label' => 'account.currency',
                            'disabled' => $edit,
                            'attr' => array(
                                'class' => 'input-xlarge'
                            )
                        )
                    )
                    ->add(
                        'overdraftFacility',
                        'money',
                        array(
                            'label' => 'account.overdraft_facility',
                            'currency' => $account->getCurrency() ? : false,
                            'attr' => array(
                                'class' => 'input-small'
                            )
                        )
                    )
                ;

                if (!$edit) {
                    $form
                        ->add(
                            'initialBalance',
                            'money',
                            array(
                                'label' => 'account.initial_balance',
                                'mapped' => false,
                                'required' => false,
                                'currency' => $account->getCurrency() ? : false,
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                    ;
                }
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            array(
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Account'
            )
        );

        $resolver->setRequired(array('member'));
    }

    public function getName()
    {
        return 'account_type';
    }
}
