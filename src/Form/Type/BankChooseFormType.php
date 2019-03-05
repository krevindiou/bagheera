<?php

declare(strict_types=1);

namespace App\Form\Type;

use App\Entity\Bank;
use App\Entity\Provider;
use App\Form\Model\BankChooseFormModel;
use App\Repository\BankRepository;
use App\Repository\ProviderRepository;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormError;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\OptionsResolver\OptionsResolver;

class BankChooseFormType extends AbstractType
{
    private $bankRepository;
    private $providerRepository;

    public function __construct(BankRepository $bankRepository, ProviderRepository $providerRepository)
    {
        $this->bankRepository = $bankRepository;
        $this->providerRepository = $providerRepository;
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
                    'class' => Provider::class,
                    'choices' => $this->providerRepository->getAvailableProviders($member),
                    'expanded' => true,
                ]
            )
            ->add(
                'bank',
                EntityType::class,
                [
                    'label' => 'bank.manual',
                    'class' => Bank::class,
                    'choices' => $this->bankRepository->getActiveManualBanks($member),
                    'expanded' => true,
                ]
            )
            ->add(
                'other',
                TextType::class,
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
            function (FormEvent $event): void {
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
        $resolver->setDefaults(
            [
                'data_class' => BankChooseFormModel::class,
            ]
        );
    }

    public function getName()
    {
        return 'app_bank_choose';
    }
}
