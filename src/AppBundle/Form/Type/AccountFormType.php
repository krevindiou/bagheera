<?php

namespace AppBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class AccountFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'name',
                null,
                [
                    'label' => 'account.name',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'submit',
                'submit',
                [
                    'label' => 'account.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            );

        $member = $options['member'];

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($builder, $member) {
                $form = $event->getForm();
                $account = $event->getData();

                $edit = (null !== $account->getAccountId());

                $form
                    ->add(
                        'bank',
                        'entity',
                        [
                            'label' => 'account.bank',
                            'empty_value' => '',
                            'class' => 'AppBundle:Bank',
                            'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($member) {
                                return $repository->createQueryBuilder('b')
                                    ->where('b.member = :member')
                                    ->andWhere('b.deleted = false')
                                    ->andWhere('b.closed = false')
                                    ->setParameter('member', $member)
                                    ->add('orderBy', 'b.name ASC');
                            },
                            'disabled' => $edit,
                            'attr' => [
                                'class' => 'input-xlarge',
                            ],
                        ]
                    )
                    ->add(
                        'currency',
                        'currency',
                        [
                            'label' => 'account.currency',
                            'disabled' => $edit,
                            'preferred_choices' => ['USD', 'EUR'],
                            'attr' => [
                                'class' => 'input-xlarge',
                            ],
                        ]
                    )
                    ->add(
                        'overdraftFacility',
                        'money',
                        [
                            'label' => 'account.overdraft_facility',
                            'currency' => $account->getCurrency() ?: false,
                            'attr' => [
                                'class' => 'input-small',
                            ],
                        ]
                    )
                ;

                if (!$edit) {
                    $form
                        ->add(
                            'initialBalance',
                            'money',
                            [
                                'label' => 'account.initial_balance',
                                'mapped' => false,
                                'required' => false,
                                'currency' => $account->getCurrency() ?: false,
                                'attr' => [
                                    'class' => 'input-small',
                                ],
                            ]
                        )
                    ;
                }
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'AppBundle\Entity\Account',
            ]
        );

        $resolver->setRequired(['member']);
    }

    public function getName()
    {
        return 'app_account';
    }
}
