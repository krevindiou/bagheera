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
use Krevindiou\BagheeraBundle\Form\Type\CurrencyType;

/**
 * Account form
 *
 * @license    http://www.gnu.org/licenses/gpl-3.0.txt    GNU GPL version 3
 * @version    $Id$
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
                    'label' => 'account_name',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
            ->add(
                'iban',
                null,
                array(
                    'label' => 'account_iban',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
            ->add(
                'bic',
                null,
                array(
                    'label' => 'account_bic',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
        ;

        $builder->addEventListener(
            FormEvents::PRE_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $account = $event->getData();

                $user = $account->getBank()->getUser();

                $edit = (null !== $account->getAccountId());

                $form
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'bank',
                            'entity',
                            null,
                            array(
                                'label' => 'account_bank',
                                'empty_value' => '',
                                'class' => 'Krevindiou\BagheeraBundle\Entity\Bank',
                                'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($user) {
                                    return $repository->createQueryBuilder('b')
                                        ->where('b.user = :user')
                                        ->setParameter('user', $user)
                                        ->add('orderBy', 'b.name ASC');
                                },
                                'disabled' => $edit,
                                'attr' => array(
                                    'class' => 'input-xlarge'
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'currency',
                            new CurrencyType(),
                            null,
                            array(
                                'label' => 'account_currency',
                                'disabled' => $edit,
                                'attr' => array(
                                    'class' => 'input-xlarge'
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'initialBalance',
                            'money',
                            null,
                            array(
                                'label' => 'account_initial_balance',
                                'currency' => $account->getCurrency() ? : false,
                                'disabled' => $edit,
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                    )
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'overdraftFacility',
                            'money',
                            null,
                            array(
                                'label' => 'account_overdraft_facility',
                                'currency' => $account->getCurrency() ? : false,
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                    )
                ;
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
    }

    public function getName()
    {
        return 'krevindiou_bagheerabundle_accounttype';
    }
}
