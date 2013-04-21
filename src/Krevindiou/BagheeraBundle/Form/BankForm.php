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

/**
 * @DI\FormType
 */
class BankForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'name',
                null,
                array(
                    'label' => 'bank_name',
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
                $bank = $event->getData();

                $user = $bank->getUser();

                $edit = (null !== $bank->getBankId());

                $form
                    ->add(
                        $builder->getFormFactory()->createNamed(
                            'provider',
                            'entity',
                            null,
                            array(
                                'label' => 'bank_provider',
                                'required' => false,
                                'empty_value' => 'bank_provider_other',
                                'empty_data' => null,
                                'class' => 'Krevindiou\BagheeraBundle\Entity\Provider',
                                'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($user) {
                                    return $repository->createQueryBuilder('p')
                                        ->where('p.country = :country')
                                        ->setParameter('country', $user->getCountry())
                                        ->add('orderBy', 'p.name ASC');
                                },
                                'disabled' => $edit,
                                'attr' => array(
                                    'bankId' => $bank->getBankId(),
                                    'class' => 'input-xlarge'
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
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Bank'
            )
        );
    }

    public function getName()
    {
        return 'bank_type';
    }
}
