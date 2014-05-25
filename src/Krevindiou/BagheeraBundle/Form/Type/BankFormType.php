<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class BankFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'name',
                null,
                [
                    'label' => 'bank.name',
                    'attr' => [
                        'class' => 'input-xlarge'
                    ]
                ]
            )
            ->add(
                'submit',
                'submit',
                [
                    'label' => 'bank.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary'
                    ]
                ]
            );

        $builder->addEventListener(
            FormEvents::POST_SET_DATA,
            function (FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $bank = $event->getData();

                $member = $bank->getMember();

                $edit = (null !== $bank->getBankId());

                $form
                    ->add(
                        'provider',
                        'entity',
                        [
                            'label' => 'bank.provider',
                            'required' => false,
                            'empty_value' => 'bank.provider_other',
                            'empty_data' => null,
                            'class' => 'Krevindiou\BagheeraBundle\Entity\Provider',
                            'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($member) {
                                return $repository->createQueryBuilder('p')
                                    ->where('p.country = :country')
                                    ->setParameter('country', $member->getCountry())
                                    ->add('orderBy', 'p.name ASC');
                            },
                            'disabled' => $edit,
                            'attr' => [
                                'bankId' => $bank->getBankId(),
                                'class' => 'input-xlarge'
                            ]
                        ]
                    )
                ;
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Bank'
            ]
        );
    }

    public function getName()
    {
        return 'bank';
    }
}
