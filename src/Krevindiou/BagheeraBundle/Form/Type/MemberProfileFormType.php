<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 */

namespace Krevindiou\BagheeraBundle\Form\Type;

use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use Krevindiou\BagheeraBundle\Form\Type\MemberRegisterFormType;
use JMS\DiExtraBundle\Annotation as DI;

/**
 * @DI\FormType
 */
class MemberProfileFormType extends MemberRegisterFormType
{
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        parent::buildForm($builder, $options);

        $builder->remove('plainPassword');
        $builder->remove('country');
    }

    public function setDefaultOptions(OptionsResolverInterface $resolver)
    {
        $resolver->setDefaults(
            [
                'data_class' => 'Krevindiou\BagheeraBundle\Entity\Member'
            ]
        );
    }

    public function getName()
    {
        return 'member_profile_type';
    }
}
