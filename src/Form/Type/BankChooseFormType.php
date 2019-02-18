<?php

declare(strict_types=1);

namespace App\Form\Type;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormError;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\OptionsResolver\OptionsResolver;

class BankChooseFormType extends AbstractType
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $member = $options['member'];

        $builder
            ->add(
                'provider',
                EntityType::class,
                [
                    'label' => 'bank.auto',
                    'class' => 'App:Provider',
                    'choices' => $this->em->getRepository('App:Provider')->getAvailableProviders($member),
                    'expanded' => true,
                ]
            )
            ->add(
                'bank',
                EntityType::class,
                [
                    'label' => 'bank.manual',
                    'class' => 'App:Bank',
                    'choices' => $this->em->getRepository('App:Bank')->getActiveManualBanks($member),
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
                SubmitType::class,
                [
                    'label' => 'bank.form_submit_button',
                    'attr' => [
                        'class' => 'btn btn-primary',
                    ],
                ]
            )
        ;

        $builder->addEventListener(
            FormEvents::POST_SUBMIT,
            function (FormEvent $event) use ($builder): void {
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

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setRequired(['member']);
    }

    public function getName()
    {
        return 'app_bank_choose';
    }
}
