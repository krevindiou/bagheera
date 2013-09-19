<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormEvents;
use Symfony\Component\Form\FormEvent;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class ReportForm extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $builder
            ->add(
                'title',
                null,
                array(
                    'label' => 'report.title',
                    'attr' => array(
                        'class' => 'input-xlarge'
                    )
                )
            )
            ->add(
                'homepage',
                null,
                array(
                    'label' => 'report.homepage',
                    'required' => false
                )
            )
        ;

        $builder->addEventListener(
            FormEvents::PRE_SET_DATA,
            function(FormEvent $event) use ($builder) {
                $form = $event->getForm();
                $report = $event->getData();

                $member = $report->getMember();

                $type = $report->getType();

                if (in_array($type, array('sum', 'average', 'distribution'))) {
                    $form
                        ->add(
                            'valueDateStart',
                            'date',
                            array(
                                'label' => 'report.value_date_start',
                                'widget' => 'single_text',
                                'format' => 'yyyy-MM-dd',
                                'required' => false,
                                'attr' => array(
                                    'class' => 'input-small calendar'
                                )
                            )
                        )
                        ->add(
                            'valueDateEnd',
                            'date',
                            array(
                                'label' => 'report.value_date_end',
                                'widget' => 'single_text',
                                'format' => 'yyyy-MM-dd',
                                'required' => false,
                                'attr' => array(
                                    'class' => 'input-small calendar'
                                )
                            )
                        )
                        ->add(
                            'thirdParties',
                            'text',
                            array(
                                'label' => 'report.third_parties',
                                'required' => false,
                                'attr' => array(
                                    'class' => 'input-large'
                                )
                            )
                        )
                        /*
                        ->add(
                            'categories',
                            null,
                            array(
                                'label' => 'report.categories',
                                'empty_value' => '',
                                'required' => false,
                                'group_by' => 'type',
                                'attr' => array(
                                    'class' => 'input-xlarge'
                                )
                            )
                        )
                        ->add(
                            'paymentMethods',
                            null,
                            array(
                                'label' => 'report.payment_methods',
                                'empty_value' => '',
                                'required' => false,
                                'group_by' => 'type',
                                'attr' => array(
                                    'class' => 'input-medium'
                                )
                            )
                        )
                        */
                        ->add(
                            'accounts',
                            'entity',
                            array(
                                'label' => 'report.accounts',
                                'class' => 'Krevindiou\BagheeraBundle\Entity\Account',
                                'query_builder' => function (\Doctrine\ORM\EntityRepository $repository) use ($member) {
                                    return $repository->createQueryBuilder('a')
                                        ->innerJoin('a.bank', 'b')
                                        ->where('b.member = :member')
                                        ->andWhere('b.deleted = false')
                                        ->andWhere('b.closed = false')
                                        ->andWhere('a.deleted = false')
                                        ->setParameter('member', $member)
                                        ->add('orderBy', 'b.name ASC, a.name ASC');
                                },
                                'empty_value' => '',
                                'required' => false,
                                'multiple' => true,
                                'attr' => array(
                                    'class' => 'input-xlarge'
                                )
                            )
                        )
                        ->add(
                            'reconciledOnly',
                            'checkbox',
                            array(
                                'label' => 'report.reconciled_only',
                                'required' => false
                            )
                        )
                    ;
                }

                if (in_array($type, array('sum', 'average'))) {
                    $form
                        ->add(
                            'periodGrouping',
                            'choice',
                            array(
                                'label' => 'report.period_grouping',
                                'choices' => array(
                                    'month' => 'report.period_grouping_month',
                                    'quarter' => 'report.period_grouping_quarter',
                                    'year' => 'report.period_grouping_year',
                                    'all' => 'report.period_grouping_all'
                                ),
                                'empty_value' => '',
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                    ;
                }

                if (in_array($type, array('distribution'))) {
                    $form
                        ->add(
                            'dataGrouping',
                            'choice',
                            array(
                                'label' => 'report.data_grouping',
                                'choices' => array(
                                    'category' => 'report.data_grouping_category',
                                    'third_party' => 'report.data_grouping_third_party',
                                    'payment_method' => 'report.data_grouping_payment_method',
                                ),
                                'empty_value' => '',
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                        ->add(
                            'significantResultsNumber',
                            null,
                            array(
                                'label' => 'report.significant_results_number',
                                'attr' => array(
                                    'class' => 'input-mini'
                                )
                            )
                        )
                    ;
                }

                if (in_array($type, array('estimate'))) {
                    $form
                        ->add(
                            'monthExpenses',
                            'money',
                            array(
                                'label' => 'report.month_expenses',
                                'currency' => false,
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                        ->add(
                            'monthIncomes',
                            'money',
                            array(
                                'label' => 'report.month_incomes',
                                'currency' => false,
                                'attr' => array(
                                    'class' => 'input-small'
                                )
                            )
                        )
                        ->add(
                            'estimateDurationValue',
                            'text',
                            array(
                                'label' => 'report.estimate_duration_value',
                                'attr' => array(
                                    'class' => 'input-mini'
                                )
                            )
                        )
                        ->add(
                            'estimateDurationUnit',
                            'choice',
                            array(
                                'label' => 'report.estimate_duration_unit',
                                'choices' => array(
                                    'month' => 'report.estimate_duration_unit_month',
                                    'year' => 'report.estimate_duration_unit_year',
                                ),
                                'empty_value' => '',
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
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Report',
                'validation_groups' => function(FormInterface $form) {
                    return array('Default', $form->getData()->getType());
                }
            )
        );
    }

    public function getName()
    {
        return 'report_type';
    }
}
