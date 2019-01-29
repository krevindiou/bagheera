<?php

namespace AppBundle\Form\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormError;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class BankChooseFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $member = $options['member'];

        $builder
            ->add(
                'provider',
                'entity',
                [
                    'label' => 'bank.auto',
                    'class' => 'AppBundle:Provider',
                    'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($member) {
                        return $repository->getAvailableProvidersQueryBuilder($member);
                    },
                    'expanded' => true,
                ]
            )
            ->add(
                'bank',
                'entity',
                [
                    'label' => 'bank.manual',
                    'class' => 'AppBundle:Bank',
                    'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($member) {
                        return $repository->getActiveManualBanksQueryBuilder($member);
                    },
                    'expanded' => true,
                ]
            )
            ->add(
                'other',
                null,
                [
                    'label' => 'bank.other',
                    'attr' => [
                        'class' => 'input-xlarge',
                    ],
                ]
            )
            ->add(
                'submit',
                'submit',
                [
                    'label' => 'bank.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            );

        $builder->addEventListener(
            FormEvents::POST_SUBMIT,
            function (FormEvent $event) use ($builder) {
                $form = $event->getForm();

                if (
                    null === $form->get('provider')->getData()
                    && null === $form->get('bank')->getData()
                    && null === $form->get('other')->getData()
                ) {
                    $form->addError(
                        new FormError('bank.error_empty')
                    );
                }
            }
        );
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setRequired(['member']);
    }

    public function getName()
    {
        return 'app_bank_choose';
    }
}
